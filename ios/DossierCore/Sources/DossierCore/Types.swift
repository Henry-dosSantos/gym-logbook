import Foundation

// Port of src/core/types.ts. Line and Entry are classes because the parser shares them by reference, as the
// TypeScript does: an entry's dayLine is the same object as the line in Doc.lines, and suggest compares lines by
// identity.

public enum LineKind: String, Sendable {
    case header, blank, date, day, exercise, superset, note
}

public enum LintCode: String, CaseIterable, Comparable, Sendable {
    case dateBackwards = "date-backwards"
    case wrongYear = "wrong-year"
    case noName = "no-name"
    case dayAsName = "day-as-name"
    case badNumber = "bad-number"
    case missingDash = "missing-dash"
    case badSet = "bad-set"

    public static func < (a: LintCode, b: LintCode) -> Bool { a.rawValue < b.rawValue }

    public var message: String {
        switch self {
        case .dateBackwards: return "Date goes backwards"
        case .wrongYear: return "Year differs from header"
        case .noName: return "No exercise name"
        case .dayAsName: return "Day type used as exercise name"
        case .badNumber: return "Bad number"
        case .missingDash: return "Missing dash"
        case .badSet: return "Too many values in a set"
        }
    }
}

/// A set's weight: a number, or "max" (the whole stack).
public enum Weight: Equatable, Hashable, Sendable {
    case number(Double)
    case max

    /// The number, or nil for max.
    public var value: Double? {
        if case let .number(n) = self { return n }
        return nil
    }
}

public struct SetEntry: Equatable, Sendable {
    /// nil: no numeric weight (reps only, "light", malformed).
    public var weight: Weight?
    /// Weight written with an s suffix (60s = dumbbell pair).
    public var pair: Bool
    /// nil: empty or non-numeric.
    public var reps: Double?
    /// The reps slot was a duration (60s, "10 seconds").
    public var seconds: Double?

    public init(weight: Weight? = nil, pair: Bool = false, reps: Double? = nil, seconds: Double? = nil) {
        self.weight = weight
        self.pair = pair
        self.reps = reps
        self.seconds = seconds
    }
}

public struct Shorthand: Equatable, Sendable {
    public var sets: Int?
    public var repsMin: Int?
    public var repsMax: Int?

    public init(sets: Int?, repsMin: Int?, repsMax: Int?) {
        self.sets = sets
        self.repsMin = repsMin
        self.repsMax = repsMax
    }
}

public final class Line {
    /// 1-based line number.
    public let n: Int
    /// UTF-16 offset of the line start in the text.
    public let from: Int
    /// UTF-16 offset of the line end (before the "\n").
    public let to: Int
    /// The raw line.
    public let text: String
    public internal(set) var kind: LineKind
    /// Date lines.
    public internal(set) var month: Int?
    public internal(set) var day: Int?
    /// Date lines: the year as written (25), nil if absent.
    public internal(set) var year: Int?
    /// Date lines: trimmed text after the date ("" if none).
    public internal(set) var rest: String?
    /// Exercise lines: display name ("" when nameless and nothing to inherit).
    public internal(set) var name: String?
    /// Exercise lines: the name came from the previous line (continuation).
    public internal(set) var inherited: Bool = false
    /// Exercise lines ([] when shorthand).
    public internal(set) var sets: [SetEntry]?
    public internal(set) var shorthand: Shorthand?
    /// Exercise lines: cleaned sets part for display.
    public internal(set) var setsText: String?
    /// [] when clean.
    public internal(set) var flags: [LintCode] = []

    init(n: Int, from: Int, to: Int, text: String) {
        self.n = n
        self.from = from
        self.to = to
        self.text = text
        self.kind = .note
    }
}

public final class Entry {
    /// Position in Doc.entries.
    public let index: Int
    public let dateLine: Line
    public let month: Int
    public let day: Int
    /// The line holding the day type (the date line itself for "8/12 push at 11 pm").
    public internal(set) var dayLine: Line?
    /// Day type as typed with the note stripped, trimmed, e.g. "Heavy push".
    public internal(set) var dayRaw: String?
    /// Normalized day type, e.g. "heavy push".
    public internal(set) var dayKey: String?
    /// Every line of the entry, date line first, up to the line before the next date line.
    public internal(set) var lines: [Line]

    init(index: Int, dateLine: Line, month: Int, day: Int) {
        self.index = index
        self.dateLine = dateLine
        self.month = month
        self.day = day
        self.lines = [dateLine]
    }
}

public struct LintFlag: Equatable, Sendable {
    public let line: Int
    public let code: LintCode
    public let message: String

    public init(line: Int, code: LintCode, message: String) {
        self.line = line
        self.code = code
        self.message = message
    }
}

public struct Doc {
    public let text: String
    public let lines: [Line]
    public let entries: [Entry]
    public let year: Int?
    public let flags: [LintFlag]
    /// UTF-16 length of the text.
    public var length: Int { lines[lines.count - 1].to }
}

public struct ExerciseSetting: Codable, Equatable, Hashable, Sendable {
    public var target: Double?
    public var increment: Double?

    public init(target: Double? = nil, increment: Double? = nil) {
        self.target = target
        self.increment = increment
    }

    var isEmpty: Bool { target == nil && increment == nil }

    subscript(field: RuleField) -> Double? {
        get { field == .target ? target : increment }
        set {
            if field == .target { target = newValue } else { increment = newValue }
        }
    }
}

/// Same JSON shape as the web app's settings, so an export from one can be read by the other.
public struct Settings: Codable, Equatable, Sendable {
    public var aliases: [[String]]
    /// Keyed by exercise key.
    public var exercises: [String: ExerciseSetting]
    public var defaults: ExerciseSetting?

    public init(aliases: [[String]], exercises: [String: ExerciseSetting] = [:], defaults: ExerciseSetting? = nil) {
        self.aliases = aliases
        self.exercises = exercises
        self.defaults = defaults
    }
}

public enum GhostKind: String, Sendable {
    case date, day, name, weight, dash, slash
}

public struct Ghost: Equatable, Sendable {
    public let text: String
    public let kind: GhostKind
    /// The Space key accepts it.
    public let space: Bool

    public init(text: String, kind: GhostKind, space: Bool) {
        self.text = text
        self.kind = kind
        self.space = space
    }
}

public struct StripItem: Codable, Equatable, Sendable {
    public let date: String
    public let sets: String

    public init(date: String, sets: String) {
        self.date = date
        self.sets = sets
    }
}

public struct Suggestion: Equatable, Sendable {
    public let ghost: Ghost?
    public let strip: [StripItem]

    public init(ghost: Ghost?, strip: [StripItem]) {
        self.ghost = ghost
        self.strip = strip
    }
}
