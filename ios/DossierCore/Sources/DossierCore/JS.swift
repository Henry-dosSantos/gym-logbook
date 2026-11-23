import Foundation

// Small helpers that give Swift strings and regular expressions the JavaScript semantics the web core relies on.
// Offsets and lengths are in UTF-16 code units, as in JavaScript and as in UITextView's NSRange, so a cursor
// position from the text view can be passed to `suggest` unchanged.

/// A regular expression with JavaScript's semantics for the patterns used in this package.
/// Patterns write digits as [0-9] because ICU's \d also matches non-ASCII digits and JavaScript's does not.
struct Re: @unchecked Sendable {
    let regex: NSRegularExpression

    init(_ pattern: String, _ flags: String = "") {
        // Only "\n" ends a line, so "$" means the end of the input for single-line text, as in JavaScript.
        var options: NSRegularExpression.Options = [.useUnixLineSeparators]
        if flags.contains("i") { options.insert(.caseInsensitive) }
        do {
            regex = try NSRegularExpression(pattern: pattern, options: options)
        } catch {
            preconditionFailure("Bad pattern \(pattern): \(error)")
        }
    }

    func test(_ s: String) -> Bool {
        regex.firstMatch(in: s, range: NSRange(location: 0, length: s.utf16.count)) != nil
    }

    /// The whole match and its groups (nil for a group that took no part), like RegExp.prototype.exec.
    func exec(_ s: String) -> [String?]? {
        let source = NSString(string: s)
        guard let m = regex.firstMatch(in: s, range: NSRange(location: 0, length: source.length)) else { return nil }
        return Re.groups(m, source)
    }

    /// Replaces the first match (or every match with `all`) with what `transform` returns for its groups.
    func replace(_ s: String, all: Bool = false, _ transform: ([String?]) -> String) -> String {
        let source = NSString(string: s)
        let range = NSRange(location: 0, length: source.length)
        let matches: [NSTextCheckingResult]
        if all {
            matches = regex.matches(in: s, range: range)
        } else if let m = regex.firstMatch(in: s, range: range) {
            matches = [m]
        } else {
            matches = []
        }
        if matches.isEmpty { return s }
        var out = ""
        var cursor = 0
        for m in matches {
            out += source.substring(with: NSRange(location: cursor, length: m.range.location - cursor))
            out += transform(Re.groups(m, source))
            cursor = m.range.location + m.range.length
        }
        out += source.substring(from: cursor)
        return out
    }

    func replace(_ s: String, all: Bool = false, with literal: String) -> String {
        replace(s, all: all) { _ in literal }
    }

    private static func groups(_ m: NSTextCheckingResult, _ source: NSString) -> [String?] {
        (0..<m.numberOfRanges).map { i in
            let r = m.range(at: i)
            return r.location == NSNotFound ? nil : source.substring(with: r)
        }
    }
}

/// JavaScript's \s and String.prototype.trim set: WhiteSpace and LineTerminator.
@inline(__always)
func isJSSpace(_ v: UInt32) -> Bool {
    switch v {
    case 0x09...0x0D, 0x20, 0xA0, 0x1680, 0x2000...0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF:
        return true
    default:
        return false
    }
}

extension String {
    /// Length in UTF-16 code units, like String.prototype.length.
    var jsLength: Int { utf16.count }

    /// String.prototype.slice: UTF-16 offsets, negative counts from the end, out of range clamps.
    func jsSlice(_ start: Int, _ end: Int? = nil) -> String {
        let len = utf16.count
        func clamp(_ i: Int) -> Int { i < 0 ? Swift.max(0, len + i) : Swift.min(i, len) }
        let a = clamp(start)
        let b = clamp(end ?? len)
        guard a < b else { return "" }
        return NSString(string: self).substring(with: NSRange(location: a, length: b - a))
    }

    func jsIndexOf(_ needle: String) -> Int {
        if needle.isEmpty { return 0 }
        let r = NSString(string: self).range(of: needle, options: .literal)
        return r.location == NSNotFound ? -1 : r.location
    }

    func jsLastIndexOf(_ needle: String) -> Int {
        if needle.isEmpty { return jsLength }
        let r = NSString(string: self).range(of: needle, options: [.literal, .backwards])
        return r.location == NSNotFound ? -1 : r.location
    }

    /// String.prototype.startsWith, compared code unit by code unit.
    func jsStartsWith(_ prefix: String) -> Bool { utf16.starts(with: prefix.utf16) }

    func jsIncludes(_ needle: String) -> Bool { jsIndexOf(needle) >= 0 }

    func jsTrim() -> String { jsTrimEnd().jsTrimStart() }

    func jsTrimStart() -> String {
        let scalars = unicodeScalars
        guard let a = scalars.firstIndex(where: { !isJSSpace($0.value) }) else { return "" }
        return String(String.UnicodeScalarView(scalars[a...]))
    }

    func jsTrimEnd() -> String {
        let scalars = unicodeScalars
        guard let b = scalars.lastIndex(where: { !isJSSpace($0.value) }) else { return "" }
        return String(String.UnicodeScalarView(scalars[...b]))
    }

    /// /^\s/.test(s)
    var startsWithJSSpace: Bool {
        guard let first = unicodeScalars.first else { return false }
        return isJSSpace(first.value)
    }

    /// s.replace(/\s+/g, ' ')
    func collapsingJSSpaces() -> String {
        var out = String.UnicodeScalarView()
        var inSpace = false
        for u in unicodeScalars {
            if isJSSpace(u.value) {
                if !inSpace { out.append(" ") }
                inSpace = true
            } else {
                out.append(u)
                inSpace = false
            }
        }
        return String(out)
    }

    func removingAll(_ needle: String) -> String {
        replacingOccurrences(of: needle, with: "", options: .literal)
    }

    /// s.replace(/^-/, '')
    func droppingLeadingDash() -> String { hasPrefixUnit(0x2D) ? jsSlice(1) : self }

    func hasPrefixUnit(_ unit: UInt16) -> Bool { utf16.first == unit }
    func hasSuffixUnit(_ unit: UInt16) -> Bool { utf16.last == unit }

    /// String.prototype.split on a one-unit ASCII separator. Splits on UTF-16 units, so a "\n" inside "\r\n"
    /// counts (Swift treats "\r\n" as one Character, which Character-based splitting would not break).
    func jsSplit(_ separator: Character) -> [String] {
        let sep = separator.utf16.first!
        var parts: [String] = []
        var current: [UInt16] = []
        for u in utf16 {
            if u == sep {
                parts.append(String(decoding: current, as: UTF16.self))
                current.removeAll(keepingCapacity: true)
            } else {
                current.append(u)
            }
        }
        parts.append(String(decoding: current, as: UTF16.self))
        return parts
    }

    /// Runs of characters that pass `keep`, like s.split(/[^...]+/).filter(Boolean) for ASCII classes.
    func asciiWords(_ keep: (UInt16) -> Bool) -> [String] {
        var words: [String] = []
        var current: [UInt16] = []
        for u in utf16 {
            if keep(u) {
                current.append(u)
            } else if !current.isEmpty {
                words.append(String(decoding: current, as: UTF16.self))
                current.removeAll()
            }
        }
        if !current.isEmpty { words.append(String(decoding: current, as: UTF16.self)) }
        return words
    }
}

/// String(n) for a JavaScript number: 305 prints as "305", 302.5 as "302.5".
public func jsNumber(_ d: Double) -> String {
    if d.isNaN { return "NaN" }
    if d.isInfinite { return d < 0 ? "-Infinity" : "Infinity" }
    if d == d.rounded(.towardZero) && Swift.abs(d) < 1e15 { return String(Int64(d)) }
    return "\(d)"
}

/// Math.round: halves round up (towards +infinity), unlike Swift's .rounded().
func jsRound(_ d: Double) -> Double { (d + 0.5).rounded(.down) }

/// A sort that keeps equal elements in their original order, like Array.prototype.sort.
extension Array {
    func stableSorted(by areInIncreasingOrder: (Element, Element) -> Bool) -> [Element] {
        enumerated()
            .sorted { a, b in
                if areInIncreasingOrder(a.element, b.element) { return true }
                if areInIncreasingOrder(b.element, a.element) { return false }
                return a.offset < b.offset
            }
            .map(\.element)
    }
}

extension Calendar {
    /// Month (1-12) and day of `date`, like getMonth() + 1 and getDate() in local time.
    func monthDay(_ date: Date) -> (month: Int, day: Int) {
        let c = dateComponents([.month, .day], from: date)
        return (c.month ?? 0, c.day ?? 0)
    }
}
