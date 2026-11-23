import Foundation

// Port of src/core/suggest.ts: the ghost text at the cursor and the strip of the last two sessions.

private let defaultTarget: Double = 4
private let weightToken = Re(#"^[0-9]+(\.[0-9]+)?s?$"#)
private let weightOrMax = Re(#"^(?:[0-9]+(?:\.[0-9]+)?s?|max)$"#, "i")
private let weightAndReps = Re(#"^(?:[0-9]+(?:\.[0-9]+)?s?|max)-[0-9]+(?:\.[0-9]+)?s?$"#, "i")
private let lettersOnly = Re(#"^[a-z]+$"#, "i")
private let digitThenX = Re(#"[0-9]x"#, "i")
private let leadingDash = Re(#"^\s*-"#)
private let trailingDash = Re(#"-$"#)
private let parens = Re(#"\([^)]*\)"#)

private func formatWeight(_ set: SetEntry, _ weight: Weight) -> String {
    switch weight {
    case .max: return "max"
    case let .number(w): return jsNumber(w) + (set.pair ? "s" : "")
    }
}

/// The weight to suggest for set `setNumber` (1-based), from the sessions so far (oldest first).
public func suggestWeight(
    _ sessions: [Session],
    _ setNumber: Int,
    _ opts: ExerciseSetting,
    _ defaults: ExerciseSetting? = nil
) -> String? {
    guard let last = sessions.last else { return nil }
    let defaults = defaults ?? ExerciseSetting()
    if setNumber >= 2 {
        guard setNumber - 1 < last.sets.count else { return nil }
        let set = last.sets[setNumber - 1]
        guard let weight = set.weight else { return nil }
        return formatWeight(set, weight)
    }
    guard let first = last.sets.first, let weight = first.weight else { return nil }
    guard case let .number(w) = weight else { return "max" }
    let prev: Session? = sessions.count >= 2 ? sessions[sessions.count - 2] : nil
    let target = opts.target ?? defaults.target ?? defaultTarget
    var progressed = false
    if let prevFirst = prev?.sets.first, prevFirst.weight == .number(w),
       let prevReps = prevFirst.reps, let reps = first.reps {
        progressed = prevReps >= target && reps >= target
    }
    if !progressed { return formatWeight(first, weight) }
    let step = defaults.increment ?? 5
    var next = w + step
    if let increment = opts.increment {
        next = w + increment
    } else if w.truncatingRemainder(dividingBy: 5) != 0 {
        let higher = sessions
            .flatMap(\.sets)
            .compactMap { $0.weight?.value }
            .filter { $0 > w && $0 <= w + 15 }
        if let lowest = higher.min() { next = lowest }
    }
    return formatWeight(first, .number(next))
}

public struct ExerciseSummary: Equatable, Sendable {
    public let key: String
    public let name: String
    public let sessions: Int

    public init(key: String, name: String, sessions: Int) {
        self.key = key
        self.name = name
        self.sessions = sessions
    }
}

/// Every exercise with usable history, most sessions first.
public func exerciseList(_ doc: Doc, _ aliases: [[String]]) -> [ExerciseSummary] {
    let index = spellingIndex(doc, doc.entries.count, aliases)
    var out: [ExerciseSummary] = []
    for key in index.order {
        let name = index.latest[key]!
        let sessions = sessionsOf(doc, key, doc.entries.count, aliases, true)
        if !sessions.isEmpty { out.append(ExerciseSummary(key: key, name: name, sessions: sessions.count)) }
    }
    let english = Locale(identifier: "en")
    return out.stableSorted { a, b in
        if a.sessions != b.sessions { return a.sessions > b.sessions }
        return a.name.compare(b.name, locale: english) == .orderedAscending
    }
}

private func weightFor(_ doc: Doc, _ cur: Entry, _ key: String, _ setNumber: Int, _ settings: Settings) -> String? {
    let sessions = sessionsOf(doc, key, cur.index, settings.aliases, true)
    return suggestWeight(sessions, setNumber, settings.exercises[key] ?? ExerciseSetting(), settings.defaults)
}

private func lastUsableSetCount(_ doc: Doc, _ cur: Entry, _ key: String, _ settings: Settings) -> Int {
    sessionsOf(doc, key, cur.index, settings.aliases, true).last?.sets.count ?? 0
}

private func lineAt(_ doc: Doc, _ pos: Int) -> Line {
    let p = max(0, min(pos, doc.length))
    for l in doc.lines where p >= l.from && p <= l.to { return l }
    return doc.lines[doc.lines.count - 1]
}

private func entryOf(_ doc: Doc, _ line: Line) -> Entry? {
    doc.entries.last(where: { $0.dateLine.n <= line.n })
}

private struct NameSets {
    let name: String
    let sets: String
}

private func splitNamed(_ doc: Doc, _ cur: Entry, _ line: Line, _ settings: Settings) -> NameSets? {
    let norm = normalizeDashes(line.text)
    let tp = parens.replace(norm, all: true, with: "")
    if let shape = findExercise(norm), let name = shape.name {
        return NameSets(name: name, sets: shape.sets)
    }
    let known = spellingIndex(doc, cur.index, settings.aliases).known
    let units = Array(tp.utf16)
    for i in stride(from: 1, to: units.count, by: 1) where units[i] == 0x2D {
        let name = tp.jsSlice(0, i).jsTrim()
        if !name.isEmpty && known.contains(normName(name)) { return NameSets(name: name, sets: tp.jsSlice(i + 1)) }
    }
    return nil
}

private func numericGhost(_ doc: Doc, _ cur: Entry, _ line: Line, _ settings: Settings) -> Ghost? {
    guard let named = splitNamed(doc, cur, line, settings) else { return nil }
    let sp = leadingDash.replace(named.sets, with: "")
    if digitThenX.test(sp) { return nil }
    let key = exerciseKey(named.name, settings.aliases)
    let slash = sp.jsLastIndexOf("/")
    let done = slash >= 0
        ? sp.jsSlice(0, slash).jsSplit("/").filter { !$0.jsTrim().isEmpty }.count
        : 0
    let c = (slash >= 0 ? sp.jsSlice(slash + 1) : sp).jsTrimStart()
    let w = weightFor(doc, cur, key, done + 1, settings)
    func weightGhost(_ text: String) -> Ghost { Ghost(text: text, kind: .weight, space: true) }

    if c.isEmpty {
        guard let w else { return nil }
        if done >= 1 && done >= lastUsableSetCount(doc, cur, key, settings) { return nil }
        return weightGhost(w)
    }
    if weightToken.test(c) || (lettersOnly.test(c) && "max".jsStartsWith(c.lowercased())) {
        if let w, w.jsLength > c.jsLength, w.lowercased().jsStartsWith(c.lowercased()) {
            return weightGhost(w.jsSlice(c.jsLength))
        }
        if weightOrMax.test(c) { return Ghost(text: "-", kind: .dash, space: true) }
        return nil
    }
    if weightAndReps.test(c) {
        return Ghost(text: "/", kind: .slash, space: true)
    }
    return nil
}

private func stripFor(_ doc: Doc, _ cur: Entry?, _ line: Line, _ settings: Settings) -> [StripItem] {
    let index = cur?.index ?? doc.entries.count
    var key: String?
    if countsForHistory(line) {
        key = exerciseKey(line.name!, settings.aliases)
    } else {
        let name = trailingDash.replace(normalizeDashes(line.text).jsTrim(), with: "").jsTrim()
        if !name.isEmpty && spellingIndex(doc, index, settings.aliases).known.contains(normName(name)) {
            key = exerciseKey(name, settings.aliases)
        }
    }
    guard let key else { return [] }
    return sessionsOf(doc, key, index, settings.aliases, false)
        .suffix(2)
        .reversed()
        .map { StripItem(date: "\($0.entry.month)/\($0.entry.day)", sets: $0.setsText) }
}

private func dateGhost(_ doc: Doc, _ line: Line, _ today: Date, _ calendar: Calendar) -> Ghost? {
    let t = line.text
    let (month, day) = calendar.monthDay(today)
    let md = "\(month)/\(day)"
    let typed = t.jsTrim()
    if line.n != doc.lines.count || t.startsWithJSSpace || typed.jsLength >= md.jsLength || !md.jsStartsWith(typed) {
        return nil
    }
    let prev = line.n > 1 ? doc.lines[line.n - 2] : nil
    if let prev, prev.kind != .blank, !doc.entries.isEmpty { return nil }
    if let last = doc.entries.last, last.month == month, last.day == day { return nil }
    return Ghost(text: md.jsSlice(typed.jsLength), kind: .date, space: false)
}

private enum DayResult {
    /// The day-type rule does not apply to this line; try the next rule.
    case notHere
    /// The rule applies: show this ghost (or none) and stop.
    case decided(Ghost?)
}

private func dayGhost(_ doc: Doc, _ cur: Entry, _ line: Line) -> DayResult {
    let t = line.text
    if (cur.dateLine.rest ?? "") != "" || line.n != cur.dateLine.n + 1 || (!t.isEmpty && t.jsTrim().isEmpty)
        || line.kind == .exercise {
        return .notHere
    }
    let p = t.jsTrimStart().lowercased()
    if dayKeyCounts(doc, cur.index)[p] != nil { return .decided(nil) }
    let prevKey = cur.index > 0 ? doc.entries[cur.index - 1].dayKey : nil
    guard let best = rankDayTypes(doc, cur.index, prevKey, p).first else { return .notHere }
    let entry = latestEntryWithDayKey(doc, cur.index, best)
    let display = entry?.dayRaw ?? (best.jsSlice(0, 1).uppercased() + best.jsSlice(1))
    let typedLen = t.jsTrimStart().jsLength
    if display.jsLength > typedLen && display.lowercased().jsStartsWith(p) {
        return .decided(Ghost(text: display.jsSlice(typedLen), kind: .day, space: false))
    }
    return .decided(nil)
}

private func isActive(_ entry: Entry, _ today: Date, _ calendar: Calendar) -> Bool {
    let (month, day) = calendar.monthDay(today)
    if entry.month == month && entry.day == day { return true }
    guard let yesterday = calendar.date(byAdding: .day, value: -1, to: today) else { return false }
    let (ym, yd) = calendar.monthDay(yesterday)
    return calendar.component(.hour, from: today) < 4 && entry.month == ym && entry.day == yd
}

private func doneToday(_ cur: Entry, _ line: Line, _ aliases: [[String]]) -> [String] {
    cur.lines
        .filter { $0 !== line && countsForHistory($0) }
        .flatMap { [$0.name!, exerciseKey($0.name!, aliases)] }
}

private func excluded(_ done: [String], _ key: String, _ spelling: String) -> Bool {
    done.contains { related($0, key) || related($0, spelling) }
}

private func emptyLineGhost(_ doc: Doc, _ cur: Entry, _ line: Line, _ settings: Settings, _ today: Date,
                            _ calendar: Calendar) -> Ghost? {
    if cur.index != doc.entries.count - 1 || !line.text.isEmpty || line.n == cur.dateLine.n { return nil }
    if !isActive(cur, today, calendar) { return nil }
    if doc.lines[line.n - 2].kind == .blank { return nil }
    if (cur.dateLine.rest ?? "").isEmpty && line.n == cur.dateLine.n + 1 { return nil }
    guard let dayKey = cur.dayKey else { return nil }
    var ref: Entry?
    for i in stride(from: cur.index - 1, through: 0, by: -1) {
        let e = doc.entries[i]
        if e.dayKey == dayKey && !countingLines(e).isEmpty {
            ref = e
            break
        }
    }
    guard let ref else { return nil }
    let done = doneToday(cur, line, settings.aliases)
    let latest = spellingIndex(doc, cur.index, settings.aliases).latest
    for l in countingLines(ref) {
        let key = exerciseKey(l.name!, settings.aliases)
        let spelling = latest[key] ?? l.name!
        if !excluded(done, key, spelling) { return Ghost(text: spelling, kind: .name, space: false) }
    }
    return nil
}

private func nameGhost(_ doc: Doc, _ cur: Entry, _ line: Line, _ settings: Settings) -> Ghost? {
    let t = line.text
    if t.jsTrim().isEmpty || normalizeDashes(t).utf16.contains(0x2D) || line.kind == .date { return nil }
    let q = t.jsTrimStart()
    let index = spellingIndex(doc, cur.index, settings.aliases)
    if index.known.contains(normName(q)) {
        let key = exerciseKey(q, settings.aliases)
        let w = weightFor(doc, cur, key, 1, settings)
        return Ghost(text: w.map { "-" + $0 } ?? "-", kind: .weight, space: false)
    }
    let lower = q.lowercased()
    let done = doneToday(cur, line, settings.aliases)
    let candidates = index.recent.filter { k in
        let s = index.latest[k]!
        return s.jsLength > q.jsLength && s.lowercased().jsStartsWith(lower) && !excluded(done, k, s)
    }
    if candidates.isEmpty { return nil }
    var sameDay = Set<String>()
    if let dayKey = cur.dayKey {
        for e in doc.entries {
            if e.index >= cur.index { break }
            if e.dayKey != dayKey { continue }
            for l in countingLines(e) { sameDay.insert(exerciseKey(l.name!, settings.aliases)) }
        }
    }
    let pick = candidates.first(where: { sameDay.contains($0) }) ?? candidates[0]
    return Ghost(text: index.latest[pick]!.jsSlice(q.jsLength), kind: .name, space: false)
}

/// What to suggest with the cursor at UTF-16 offset `pos`. `today` is read in `calendar` (local time by default).
public func suggest(_ doc: Doc, _ pos: Int, _ settings: Settings, _ today: Date,
                    calendar: Calendar = .current) -> Suggestion {
    let line = lineAt(doc, pos)
    let cur = entryOf(doc, line)
    let strip = stripFor(doc, cur, line, settings)
    if pos != line.to { return Suggestion(ghost: nil, strip: strip) }

    if let date = dateGhost(doc, line, today, calendar) { return Suggestion(ghost: date, strip: strip) }
    guard let cur else { return Suggestion(ghost: nil, strip: strip) }

    if case let .decided(ghost) = dayGhost(doc, cur, line) { return Suggestion(ghost: ghost, strip: strip) }

    if let empty = emptyLineGhost(doc, cur, line, settings, today, calendar) {
        return Suggestion(ghost: empty, strip: strip)
    }

    if let name = nameGhost(doc, cur, line, settings) { return Suggestion(ghost: name, strip: strip) }

    return Suggestion(ghost: numericGhost(doc, cur, line, settings), strip: strip)
}
