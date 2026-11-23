import Foundation

// Port of src/core/settings.ts. Settings is a value type, so none of these functions can change their input.

public let defaultSettings = Settings(
    aliases: [
        ["Incline DB", "Incline DB press", "Incline dumbbell press"],
        ["Tricep pushdowns", "Tricep pauhdowns"],
        ["Db lat raises", "Db lat raise"],
        ["Cable lat raises", "Cable lat raise"],
        ["Leg curls", "Leg curl"],
        ["Leg extensions", "Leg extension"],
        ["Weighted sit ups", "Weighed sit ups"],
        ["Horizontal rows", "Horitonstal rows"],
        ["Bench", "Flat bench"],
    ],
    exercises: [:]
)

public enum RuleField: Sendable {
    case target, increment
}

public struct Rule: Equatable, Sendable {
    public let target: Double
    public let increment: Double

    public init(target: Double, increment: Double) {
        self.target = target
        self.increment = increment
    }

    subscript(field: RuleField) -> Double { field == .target ? target : increment }
}

public struct ExerciseRule: Equatable, Sendable {
    public let target: Double
    public let increment: Double
    public let custom: Bool

    public init(target: Double, increment: Double, custom: Bool) {
        self.target = target
        self.increment = increment
        self.custom = custom
    }
}

public let builtinRule = Rule(target: 4, increment: 5)

public func globalRule(_ s: Settings) -> Rule {
    Rule(
        target: s.defaults?.target ?? builtinRule.target,
        increment: s.defaults?.increment ?? builtinRule.increment
    )
}

public func exerciseRule(_ s: Settings, _ key: String) -> ExerciseRule {
    let own = s.exercises[key]
    let base = globalRule(s)
    return ExerciseRule(
        target: own?.target ?? base.target,
        increment: own?.increment ?? base.increment,
        custom: own != nil && (own?.target != nil || own?.increment != nil)
    )
}

public func setGlobal(_ s: Settings, _ field: RuleField, _ value: Double) -> Settings {
    var defaults = s.defaults ?? ExerciseSetting()
    defaults[field] = value == builtinRule[field] ? nil : value
    var out = s
    out.defaults = defaults.isEmpty ? nil : defaults
    return out
}

public func setExerciseRule(_ s: Settings, _ key: String, _ field: RuleField, _ value: Double) -> Settings {
    var entry = s.exercises[key] ?? ExerciseSetting()
    entry[field] = value == globalRule(s)[field] ? nil : value
    var out = s
    out.exercises[key] = entry.isEmpty ? nil : entry
    return out
}

public func clearExerciseRule(_ s: Settings, _ key: String) -> Settings {
    var out = s
    out.exercises[key] = nil
    return out
}

public func setAliasGroups(_ s: Settings, _ groups: [[String]]) -> Settings {
    var out = s
    out.aliases = groups
        .map { g in g.map { $0.jsTrim() }.filter { !$0.isEmpty } }
        .filter { $0.count >= 2 }
    return out
}

public func clearAllExerciseRules(_ s: Settings) -> Settings {
    var out = s
    out.exercises = [:]
    return out
}
