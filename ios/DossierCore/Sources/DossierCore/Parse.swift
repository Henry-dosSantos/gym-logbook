import Foundation

// Port of src/core/parse.ts. The parser reads the text and never changes it: Doc.text is the input, and the
// lines joined with "\n" give it back exactly.

private enum P {
    static let date = Re(#"^\s*([0-9]{1,2})/([0-9]{1,2})(?:/([0-9]{2,4}))?(?:\s+(.*))?$"#)
    static let superset = Re(#"^\s*superset\b.*:\s*$"#, "i")
    static let nameless = Re(#"^-?\s*(?:[0-9]+(?:\.[0-9]+)?[a-z]*|max)\s*-"#, "i")
    static let setStart = Re(#"^\s*(?:[0-9]+(?:\.[0-9]+)?[a-z]*|max|light)\s*(?:-|x|/|$)"#, "i")
    static let paren = Re(#"\([^)]*\)"#)
    static let trailingBang = Re(#"[.!]+$"#)
    static let shorthandA = Re(#"^([0-9]+)\s*x\s*([0-9]+)?(?:\s*-\s*([0-9]+))?"#, "i")
    static let shorthandB = Re(#"^([0-9]+)(?:-([0-9]+))?\s*x\s*([0-9]+)\s*$"#, "i")
    static let number = Re(#"^[0-9]+(\.[0-9]+)?$"#)
    static let pairNumber = Re(#"^[0-9]+(\.[0-9]+)?s$"#)
    static let max = Re(#"^max$"#, "i")
    static let digitFirst = Re(#"^[0-9]"#)
    static let duration = Re(#"^([0-9]+(?:\.[0-9]+)?)\s*(?:s|sec|secs|second|seconds)$"#, "i")
    static let trailingDashSpace = Re(#"[-\s]+$"#)
    static let headerYear = Re(#"\b(20[0-9][0-9])\b"#)
}

private let mark = "\u{0001}"
private let dash: UInt16 = 0x2D
private let markUnit: UInt16 = 0x01

/// En and em dashes become "-".
public func normalizeDashes(_ s: String) -> String {
    s.replacingOccurrences(of: "\u{2013}", with: "-", options: .literal)
        .replacingOccurrences(of: "\u{2014}", with: "-", options: .literal)
}

private struct ParsedDate {
    let month: Int
    let day: Int
    let year: Int?
    let rest: String
}

private func parseDate(_ norm: String) -> ParsedDate? {
    guard let m = P.date.exec(norm.jsTrimEnd()),
          let month = Int(m[1] ?? ""), let day = Int(m[2] ?? "")
    else { return nil }
    if month < 1 || month > 12 || day < 1 || day > 31 { return nil }
    return ParsedDate(month: month, day: day, year: m[3].flatMap { Int($0) }, rest: (m[4] ?? "").jsTrim())
}

public struct DayName: Equatable, Sendable {
    public let raw: String?
    public let key: String?

    public init(raw: String?, key: String?) {
        self.raw = raw
        self.key = key
    }
}

/// The day type in a line: "Heavy push - exam day" is raw "Heavy push", key "heavy push".
public func normalizeDay(_ text: String) -> DayName {
    let norm = normalizeDashes(text)
    var cut = norm.jsLength
    for sep in ["-", ". ", "(", ","] {
        let i = norm.jsIndexOf(sep)
        if i >= 0 && i < cut { cut = i }
    }
    let raw = P.trailingBang.replace(norm.jsSlice(0, cut).jsTrim(), with: "").jsTrim()
    if raw.isEmpty { return DayName(raw: nil, key: nil) }
    return DayName(raw: raw, key: raw.lowercased().collapsingJSSpaces())
}

public struct ExerciseShape: Equatable, Sendable {
    /// nil: the line has sets but no name of its own.
    public let name: String?
    public let sets: String
}

/// Where the name ends and the sets begin, if the line looks like an exercise.
public func findExercise(_ norm: String) -> ExerciseShape? {
    var p = P.paren.replace(norm.jsTrimEnd(), all: true, with: mark)
    if p.hasSuffixUnit(0x3A) { p = p.jsSlice(0, -1) + "/" }
    let stripped = p.removingAll(mark).jsTrim()
    if P.nameless.test(stripped) { return ExerciseShape(name: nil, sets: stripped.droppingLeadingDash()) }
    let units = Array(p.utf16)
    for i in stride(from: 1, to: units.count, by: 1) {
        if units[i] != dash && units[i] != markUnit { continue }
        let name = p.jsSlice(0, i).removingAll(mark).jsTrim()
        if name.isEmpty { continue }
        let after = p.jsSlice(i + 1)
        if P.setStart.test(after) { return ExerciseShape(name: name, sets: after.removingAll(mark)) }
    }
    return nil
}

private struct ParsedSets {
    let sets: [SetEntry]
    let shorthand: Shorthand?
    let setsText: String
    let flags: [LintCode]
}

private func parseSets(_ input: String) -> ParsedSets {
    var flags: [LintCode] = []
    var s = input.jsTrim()
    if s.hasPrefixUnit(dash) { s = s.jsSlice(1).jsTrim() }
    let segments = s.jsSplit("/").map { $0.jsTrim() }.filter { !$0.isEmpty }
    let setsText = segments.joined(separator: "/")

    let body = s.hasSuffixUnit(0x2F) ? s.jsSlice(0, -1) : s
    var shorthand: Shorthand?
    if let m1 = P.shorthandA.exec(body) {
        let min = m1[2].flatMap { Int($0) }
        shorthand = Shorthand(
            sets: m1[1].flatMap { Int($0) },
            repsMin: min,
            repsMax: m1[3] != nil ? m1[3].flatMap { Int($0) } : min
        )
    } else if let m2 = P.shorthandB.exec(body) {
        let low = m2[1].flatMap { Int($0) }
        shorthand = Shorthand(
            sets: m2[3].flatMap { Int($0) },
            repsMin: low,
            repsMax: m2[2] == nil ? low : m2[2].flatMap { Int($0) }
        )
    }
    if let shorthand { return ParsedSets(sets: [], shorthand: shorthand, setsText: setsText, flags: flags) }

    var out: [SetEntry] = []
    for seg in segments {
        var parts = seg.jsSplit("-").map { $0.jsTrim() }
        if parts.count > 2 && parts[parts.count - 1].isEmpty { parts.removeLast() }
        if parts.count > 2 { flags.append(.badSet) }
        var set = SetEntry()
        let repsToken = parts.count == 1 ? parts[0] : parts[1]
        if parts.count >= 2 {
            let w = parts[0]
            if P.number.test(w) {
                set.weight = Double(w).map { Weight.number($0) }
            } else if P.pairNumber.test(w) {
                set.weight = Double(w.jsSlice(0, -1)).map { Weight.number($0) }
                set.pair = true
            } else if P.max.test(w) {
                set.weight = .max
            } else if P.digitFirst.test(w) {
                flags.append(.badNumber)
            }
        }
        if P.number.test(repsToken) {
            set.reps = Double(repsToken)
        } else if let sec = P.duration.exec(repsToken) {
            set.seconds = sec[1].flatMap { Double($0) }
        } else if P.digitFirst.test(repsToken) {
            flags.append(.badNumber)
        }
        out.append(set)
    }
    return ParsedSets(sets: out, shorthand: nil, setsText: setsText, flags: flags)
}

private func nameFromNote(_ text: String) -> String {
    let stripped = P.paren.replace(normalizeDashes(text), all: true, with: "").jsTrim()
    let dot = stripped.jsIndexOf(". ")
    let head = dot >= 0 ? stripped.jsSlice(0, dot) : stripped
    return P.trailingDashSpace.replace(head, with: "").jsTrim()
}

public func parseDoc(_ text: String) -> Doc {
    var lines: [Line] = []
    var norms: [String] = []
    var from = 0
    for (i, raw) in text.jsSplit("\n").enumerated() {
        let length = raw.jsLength
        lines.append(Line(n: i + 1, from: from, to: from + length, text: raw))
        norms.append(normalizeDashes(raw))
        from += length + 1
    }

    var year: Int?
    var shapes: [Int: ExerciseShape] = [:]
    for (i, line) in lines.enumerated() {
        let norm = norms[i]
        if norm.jsTrim().isEmpty {
            line.kind = .blank
            continue
        }
        let date = parseDate(norm)
        if i == 0 && date == nil, let y = P.headerYear.exec(norm), let value = Int(y[1] ?? "") {
            line.kind = .header
            year = value
            continue
        }
        if let date {
            line.kind = .date
            line.month = date.month
            line.day = date.day
            line.year = date.year
            line.rest = date.rest
            continue
        }
        if P.superset.test(norm) {
            line.kind = .superset
            continue
        }
        if let shape = findExercise(norm) {
            line.kind = .exercise
            shapes[i] = shape
        }
    }

    var entries: [Entry] = []
    for (i, line) in lines.enumerated() where line.kind == .date {
        let entry = Entry(index: entries.count, dateLine: line, month: line.month!, day: line.day!)
        var j = i + 1
        while j < lines.count && lines[j].kind != .date {
            entry.lines.append(lines[j])
            j += 1
        }
        entries.append(entry)
    }

    func candidatesOf(_ entry: Entry) -> [Line] {
        var out: [Line] = []
        for l in entry.lines.dropFirst() {
            if l.kind == .exercise || l.kind == .superset { break }
            if l.kind == .note && out.count < 3 { out.append(l) }
        }
        return out
    }
    let provisional: [String?] = entries.map { e in
        if let rest = e.dateLine.rest, !rest.isEmpty { return normalizeDay(rest).key }
        guard let first = candidatesOf(e).first(where: { $0.n == e.dateLine.n + 1 }) else { return nil }
        return normalizeDay(first.text).key
    }
    var counts: [String: Int] = [:]
    for k in provisional { if let k { counts[k, default: 0] += 1 } }

    for e in entries {
        var dayLine: Line?
        var dayText = ""
        if let rest = e.dateLine.rest, !rest.isEmpty {
            dayLine = e.dateLine
            dayText = rest
        } else {
            let cands = candidatesOf(e)
            let first = cands.first(where: { $0.n == e.dateLine.n + 1 })
            func keyOf(_ l: Line) -> String? { normalizeDay(l.text).key }
            let firstKey = first.flatMap(keyOf)
            if let first, let firstKey, counts[firstKey, default: 0] >= 2 {
                dayLine = first
            } else {
                dayLine = cands.first(where: { l in
                    guard let k = keyOf(l) else { return false }
                    return counts[k, default: 0] >= 2
                })
                if dayLine == nil, let first, firstKey != nil { dayLine = first }
            }
            if let dayLine {
                dayLine.kind = .day
                dayText = dayLine.text
            }
        }
        e.dayLine = dayLine
        if dayLine != nil {
            let d = normalizeDay(dayText)
            e.dayRaw = d.raw
            e.dayKey = d.key
        }
    }

    for (i, line) in lines.enumerated() {
        guard let shape = shapes[i], line.kind == .exercise else { continue }
        let parsed = parseSets(shape.sets)
        line.sets = parsed.sets
        line.shorthand = parsed.shorthand
        line.setsText = parsed.setsText
        for f in parsed.flags where !line.flags.contains(f) { line.flags.append(f) }
        if let name = shape.name {
            line.name = name
            continue
        }
        let prev = i > 0 ? lines[i - 1] : nil
        var name = ""
        if let prev, prev.kind == .exercise, let prevName = prev.name, !prevName.isEmpty {
            name = prevName
        } else if let prev, prev.kind == .note {
            name = nameFromNote(prev.text)
        }
        line.name = name
        if !name.isEmpty { line.inherited = true } else { line.flags.append(.noName) }
    }

    var dayCounts: [String: Int] = [:]
    for e in entries { if let k = e.dayKey { dayCounts[k, default: 0] += 1 } }
    for l in lines {
        guard l.kind == .exercise, !l.inherited, let name = l.name, !name.isEmpty else { continue }
        let key = name.lowercased().collapsingJSSpaces()
        if dayCounts[key, default: 0] >= 2 { l.flags.append(.dayAsName) }
        if let last = name.utf16.last, (0x30...0x39).contains(last) { l.flags.append(.missingDash) }
    }

    var max: (ordinal: Int, month: Int)?
    for l in lines where l.kind == .date {
        let month = l.month!
        let ordinal = month * 31 + l.day!
        if let current = max {
            if ordinal >= current.ordinal {
                max = (ordinal, month)
            } else if current.month - month >= 6 {
                max = (ordinal, month)
            } else {
                l.flags.append(.dateBackwards)
            }
        } else {
            max = (ordinal, month)
        }
        if let ly = l.year, let year, ly % 100 != year % 100 { l.flags.append(.wrongYear) }
    }

    var flags: [LintFlag] = []
    for l in lines {
        for code in l.flags { flags.append(LintFlag(line: l.n, code: code, message: code.message)) }
    }
    flags = flags.stableSorted { a, b in a.line != b.line ? a.line < b.line : a.code < b.code }

    return Doc(text: text, lines: lines, entries: entries, year: year, flags: flags)
}
