import Foundation

// Port of src/core/stats.ts.

public enum Metric: String, Sendable { case weight, reps }
public enum Mode: String, Sendable { case sets, oneRm = "1rm" }

public struct OneRmSource: Equatable, Sendable {
    public let weight: Double
    public let reps: Double

    public init(weight: Double, reps: Double) {
        self.weight = weight
        self.reps = reps
    }
}

public struct SeriesPoint: Equatable, Sendable {
    public let date: String
    public let weight: Double?
    public let max: Bool
    public let reps: Double?
    public let setsText: String
    public let oneRm: Double?
    public let oneRmFrom: OneRmSource?
}

public struct DashboardItem: Equatable, Sendable {
    public let key: String
    public let name: String
    public let sessions: Int
    public let latestText: String
    public let spark: [Double?]
    public let oneRmLatest: Double?
    public let oneRmSpark: [Double?]
}

public func exerciseSeries(_ doc: Doc, _ key: String, _ aliases: [[String]]) -> [SeriesPoint] {
    sessionsOf(doc, key, doc.entries.count, aliases, true).map { s in
        let first = s.sets[0]
        var oneRm: Double?
        var oneRmFrom: OneRmSource?
        for set in s.sets {
            guard let weight = set.weight?.value, let reps = set.reps else { continue }
            guard let estimate = estimate1RM(weight, reps) else { continue }
            if let best = oneRm, estimate <= best { continue }
            oneRm = estimate
            oneRmFrom = OneRmSource(weight: weight, reps: reps)
        }
        return SeriesPoint(
            date: "\(s.entry.month)/\(s.entry.day)",
            weight: first.weight?.value,
            max: first.weight == .max,
            reps: first.reps,
            setsText: s.setsText,
            oneRm: oneRm,
            oneRmFrom: oneRmFrom
        )
    }
}

public func metricPoints(_ series: [SeriesPoint], _ metric: Metric) -> [SeriesPoint] {
    series.filter { (metric == .weight ? $0.weight : $0.reps) != nil }
}

/// "290 × 3", "max × 10", "290", "× 10".
public func setText(_ p: SeriesPoint) -> String {
    let w = p.weight.map { jsNumber($0) } ?? (p.max ? "max" : "")
    let r = p.reps.map { "× " + jsNumber($0) } ?? ""
    return [w, r].filter { !$0.isEmpty }.joined(separator: " ")
}

public func dashboardItems(_ doc: Doc, _ aliases: [[String]]) -> [DashboardItem] {
    var items: [DashboardItem] = []
    for summary in exerciseList(doc, aliases) where summary.sessions >= 2 {
        let series = exerciseSeries(doc, summary.key, aliases)
        let withWeight = series.filter { $0.weight != nil }.count
        let useWeight = withWeight >= 2 && withWeight * 2 >= series.count
        let oneRmSpark: [Double?] = series.map { $0.oneRm }
        let oneRmLatest: Double? = oneRmSpark.last(where: { $0 != nil }) ?? nil
        items.append(DashboardItem(
            key: summary.key,
            name: summary.name,
            sessions: summary.sessions,
            latestText: setText(series[series.count - 1]),
            spark: series.map { useWeight ? $0.weight : $0.reps },
            oneRmLatest: oneRmLatest,
            oneRmSpark: oneRmSpark
        ))
    }
    return items
}
