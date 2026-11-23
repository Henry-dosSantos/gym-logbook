import Foundation

// Port of src/core/onerm.ts: the Wathan formula.

/// Estimated one-rep max for `reps` at `weight`, or nil when it cannot be estimated.
public func estimate1RM(_ weight: Double, _ reps: Double) -> Double? {
    if weight <= 0 || reps < 1 { return nil }
    if reps == 1 { return weight }
    return (100 * weight) / (48.8 + 53.8 * exp(-0.075 * reps))
}
