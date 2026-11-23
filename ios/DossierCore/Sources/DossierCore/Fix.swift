import Foundation

// Port of src/core/fix.ts: the suggested replacement for a flagged line. The app applies it only when the user
// confirms; nothing here changes the text.

private let validSuffix = Re(#"^(s|sec|secs|second|seconds)$"#, "i")
private let leadingSpace = Re(#"^\s*"#)
private let leadingMonth = Re(#"^[0-9]{1,2}(?=/)"#)
private let dateWithYear = Re(#"^([0-9]{1,2}/[0-9]{1,2})/[0-9]{2,4}"#)
private let numberWithLetters = Re(#"(?<![0-9.a-z])([0-9]+(?:\.[0-9]+)?)([a-z]+)(?=[-/(]|$)"#, "i")
private let trailingNumber = Re(#"^(.*?)([0-9]+)$"#)
private let threeValues = Re(#"(?<![0-9.])([0-9]+(?:\.[0-9]+)?)-([0-9]+(?:\.[0-9]+)?)-([0-9]+(?:\.[0-9]+)?)(?![0-9.])"#)

private func backwardsMonth(_ doc: Doc, _ line: Line) -> Int? {
    var max: (ordinal: Int, month: Int, day: Int)?
    for l in doc.lines {
        if l.n >= line.n { break }
        if l.kind != .date { continue }
        let month = l.month!
        let day = l.day!
        let ordinal = month * 31 + day
        if let current = max {
            if ordinal >= current.ordinal || current.month - month >= 6 { max = (ordinal, month, day) }
        } else {
            max = (ordinal, month, day)
        }
    }
    guard let max, let day = line.day else { return nil }
    if day >= max.day { return max.month }
    return max.month == 12 ? 1 : max.month + 1
}

private func entryOfLine(_ doc: Doc, _ line: Line) -> Entry? {
    doc.entries.last(where: { $0.dateLine.n <= line.n })
}

private struct Candidate {
    let key: String
    let n: Int
    let diff: Double
    let last: Int
    let sameDay: Bool
}

private func guessName(_ doc: Doc, _ line: Line, _ aliases: [[String]]) -> String? {
    guard let first = line.sets?.first?.weight?.value, let entry = entryOfLine(doc, line) else { return nil }
    let index = spellingIndex(doc, entry.index, aliases)
    var candidates: [Candidate] = []
    for key in index.order {
        let sessions = sessionsOf(doc, key, entry.index, aliases, true)
        guard let last = sessions.last, let h = last.sets.first?.weight?.value else { continue }
        if abs(h - first) > 0.1 * first { continue }
        candidates.append(Candidate(
            key: key,
            n: sessions.count,
            diff: abs(h - first),
            last: last.entry.index,
            sameDay: entry.dayKey != nil && sessions.contains { $0.entry.dayKey == entry.dayKey }
        ))
    }
    let pool = candidates.contains(where: \.sameDay) ? candidates.filter(\.sameDay) : candidates
    let sorted = pool.stableSorted { a, b in
        if a.n != b.n { return a.n > b.n }
        if a.diff != b.diff { return a.diff < b.diff }
        return a.last > b.last
    }
    return sorted.first.map { index.latest[$0.key]! }
}

/// The corrected line for the first flag on `line`, or nil when there is no confident fix.
public func suggestFix(_ doc: Doc, _ line: Line, _ aliases: [[String]] = defaultSettings.aliases) -> String? {
    guard let code = doc.flags.first(where: { $0.line == line.n })?.code else { return nil }
    let text = line.text
    let indent = leadingSpace.exec(text)?[0] ?? ""
    let body = text.jsSlice(indent.jsLength)

    switch code {
    case .dateBackwards:
        guard let month = backwardsMonth(doc, line) else { return nil }
        return indent + leadingMonth.replace(body, with: String(month))
    case .wrongYear:
        return indent + dateWithYear.replace(body) { g in g[1] ?? "" }
    case .badNumber:
        let fixed = numberWithLetters.replace(text, all: true) { g in
            validSuffix.test(g[2] ?? "") ? (g[0] ?? "") : (g[1] ?? "")
        }
        return fixed == text ? nil : fixed
    case .missingDash:
        let name = line.name ?? ""
        let at = text.jsIndexOf(name)
        guard at >= 0, let match = trailingNumber.exec(name) else { return nil }
        return text.jsSlice(0, at) + (match[1] ?? "") + "-" + (match[2] ?? "") + text.jsSlice(at + name.jsLength)
    case .badSet:
        let fixed = threeValues.replace(text) { g in (g[1] ?? "") + "x" + (g[2] ?? "") + "-" + (g[3] ?? "") }
        return fixed == text ? nil : fixed
    case .noName, .dayAsName:
        guard let name = guessName(doc, line, aliases) else { return nil }
        let sets = code == .noName ? body.droppingLeadingDash() : body.jsSlice(body.jsIndexOf("-") + 1)
        return indent + name + "-" + sets
    }
}
