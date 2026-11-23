import Foundation

// Port of src/core/history.ts.

public struct Session {
    public let entry: Entry
    public let sets: [SetEntry]
    public let setsText: String
}

public struct SpellingIndex {
    /// Normalized spellings seen in history.
    public let known: Set<String>
    /// Key -> most recent spelling as typed.
    public let latest: [String: String]
    /// Keys in the order of `latest` in the TypeScript (by when each was last used, oldest first).
    public let order: [String]
    /// Keys, most recently used first.
    public var recent: [String] { order.reversed() }
}

private let localBad: Set<LintCode> = [.noName, .dayAsName, .missingDash]

public func normName(_ s: String) -> String { s.lowercased().jsTrim().collapsingJSSpaces() }

/// Maps names to exercise keys for one set of alias groups, remembering what it has worked out.
final class AliasIndex: @unchecked Sendable {
    private let members: [String: String]
    private var names: [String: String] = [:]
    private let lock = NSLock()

    init(_ aliases: [[String]]) {
        var members: [String: String] = [:]
        for group in aliases {
            for member in group {
                let m = normName(member)
                if members[m] == nil { members[m] = normName(group[0]) }
            }
        }
        self.members = members
    }

    func key(_ name: String) -> String {
        lock.lock()
        defer { lock.unlock() }
        if let key = names[name] { return key }
        let n = normName(name)
        let key = members[n] ?? n
        names[name] = key
        return key
    }
}

private final class AliasCache: @unchecked Sendable {
    private var indexes: [[[String]]: AliasIndex] = [:]
    private let lock = NSLock()

    func index(_ aliases: [[String]]) -> AliasIndex {
        lock.lock()
        defer { lock.unlock() }
        if let index = indexes[aliases] { return index }
        if indexes.count >= 16 { indexes.removeAll() }
        let index = AliasIndex(aliases)
        indexes[aliases] = index
        return index
    }
}

private let aliasCache = AliasCache()

func aliasIndex(_ aliases: [[String]]) -> AliasIndex { aliasCache.index(aliases) }

public func exerciseKey(_ name: String, _ aliases: [[String]]) -> String {
    aliasIndex(aliases).key(name)
}

public func countsForHistory(_ line: Line) -> Bool {
    guard line.kind == .exercise, let name = line.name, !name.isEmpty else { return false }
    return !line.flags.contains(where: { localBad.contains($0) })
}

public func isUsable(_ line: Line) -> Bool {
    countsForHistory(line) && line.shorthand == nil && line.flags.isEmpty
}

public func countingLines(_ entry: Entry) -> [Line] {
    entry.lines.filter(countsForHistory)
}

public func sessionsOf(
    _ doc: Doc,
    _ key: String,
    _ beforeEntry: Int,
    _ aliases: [[String]],
    _ usableOnly: Bool
) -> [Session] {
    let index = aliasIndex(aliases)
    var out: [Session] = []
    for entry in doc.entries {
        if entry.index >= beforeEntry { break }
        let lines = entry.lines.filter {
            countsForHistory($0) && index.key($0.name!) == key && (!usableOnly || isUsable($0))
        }
        if lines.isEmpty { continue }
        let sets = lines.flatMap { $0.sets ?? [] }
        if usableOnly && sets.isEmpty { continue }
        out.append(Session(entry: entry, sets: sets, setsText: lines.map { $0.setsText ?? "" }.joined(separator: "/")))
    }
    return out
}

public func spellingIndex(_ doc: Doc, _ beforeEntry: Int, _ aliases: [[String]]) -> SpellingIndex {
    let index = aliasIndex(aliases)
    var known = Set<String>()
    var latest: [String: String] = [:]
    var stamp: [String: Int] = [:]
    var clock = 0
    for entry in doc.entries {
        if entry.index >= beforeEntry { break }
        for l in countingLines(entry) {
            let name = l.name!
            let key = index.key(name)
            known.insert(normName(name))
            latest[key] = name
            stamp[key] = clock
            clock += 1
        }
    }
    let order = latest.keys.sorted { stamp[$0]! < stamp[$1]! }
    return SpellingIndex(known: known, latest: latest, order: order)
}

public func dayKeyCounts(_ doc: Doc, _ beforeEntry: Int) -> [String: Int] {
    var counts: [String: Int] = [:]
    for e in doc.entries {
        if e.index >= beforeEntry { break }
        if let k = e.dayKey { counts[k, default: 0] += 1 }
    }
    return counts
}

public func latestEntryWithDayKey(_ doc: Doc, _ beforeEntry: Int, _ dayKey: String) -> Entry? {
    var i = min(beforeEntry, doc.entries.count) - 1
    while i >= 0 {
        if doc.entries[i].dayKey == dayKey { return doc.entries[i] }
        i -= 1
    }
    return nil
}

public func rankDayTypes(_ doc: Doc, _ beforeEntry: Int, _ prevKey: String?, _ prefix: String) -> [String] {
    let counts = dayKeyCounts(doc, beforeEntry)
    var following: [String: Int] = [:]
    var lastIndex: [String: Int] = [:]
    for e in doc.entries {
        if e.index >= beforeEntry { break }
        if let k = e.dayKey { lastIndex[k] = e.index }
        let prev = e.index > 0 ? doc.entries[e.index - 1] : nil
        if let prevKey, let prev, prev.dayKey == prevKey, let k = e.dayKey {
            following[k, default: 0] += 1
        }
    }
    // lastIndex differs for every key, so this order is total and the dictionary's order does not matter.
    let ranked = counts.keys
        .filter { counts[$0]! >= 2 && $0.jsStartsWith(prefix) }
        .sorted { a, b in
            let fa = following[a, default: 0]
            let fb = following[b, default: 0]
            return fa != fb ? fa > fb : lastIndex[a]! > lastIndex[b]!
        }
    guard let next = nextInRotation(doc, beforeEntry, prefix) else { return ranked }
    return [next] + ranked.filter { $0 != next }
}

private let trio = ["push", "pull", "legs"]
private let leadingTrio = Re(#"^\s*(push|pull|legs)\b"#, "i")

/// Which of push, pull and legs an entry was: from its day type, else from a line that starts with one.
public func trioOf(_ entry: Entry) -> String? {
    if let dayKey = entry.dayKey,
       let fromDay = dayKey.asciiWords({ (0x61...0x7A).contains($0) }).first(where: { trio.contains($0) }) {
        return fromDay
    }
    for line in entry.lines.dropFirst() {
        if let m = leadingTrio.exec(line.text), let word = m[1] { return word.lowercased() }
    }
    return nil
}

/// Of push, pull and legs, the one done longest ago, assumed to be today's.
/// Only types that appear in the log count; prefix narrows the choice.
public func nextInRotation(_ doc: Doc, _ beforeEntry: Int, _ prefix: String) -> String? {
    var last: [String: Int] = [:]
    for i in 0..<max(0, min(beforeEntry, doc.entries.count)) {
        if let t = trioOf(doc.entries[i]) { last[t] = i }
    }
    var pick: String?
    for t in trio {
        guard let lt = last[t], t.jsStartsWith(prefix) else { continue }
        if let p = pick, let lp = last[p], lp <= lt { continue }
        pick = t
    }
    return pick
}

/// The text of the entry dated today, else of the last entry, without trailing blank lines.
public func todayText(_ doc: Doc, _ today: Date, calendar: Calendar = .current) -> String? {
    guard var entry = doc.entries.last else { return nil }
    let (month, day) = calendar.monthDay(today)
    for e in doc.entries.reversed() where e.month == month && e.day == day {
        entry = e
        break
    }
    guard let last = entry.lines.last(where: { $0.kind != .blank }) else { return nil }
    return doc.text.jsSlice(entry.dateLine.from, last.to)
}

private func tokens(_ s: String) -> [String] {
    normName(s).asciiWords { u in (0x61...0x7A).contains(u) || (0x30...0x39).contains(u) || u == 0x2E }
}

private func containsRun(_ outer: [String], _ inner: [String]) -> Bool {
    if inner.isEmpty || inner.count > outer.count { return false }
    for i in 0...(outer.count - inner.count) where Array(outer[i..<(i + inner.count)]) == inner {
        return true
    }
    return false
}

/// One name's words appear, in order and together, in the other's ("Chin ups" and "Weighted chin ups").
public func related(_ a: String, _ b: String) -> Bool {
    let x = tokens(a)
    let y = tokens(b)
    return containsRun(x, y) || containsRun(y, x)
}
