import Foundation

// Port of src/core/chart.ts: where a series' points sit in a chart, and the SVG-style path through them.

public struct Pad: Equatable, Sendable {
    public var top: Double
    public var right: Double
    public var bottom: Double
    public var left: Double

    public init(top: Double, right: Double, bottom: Double, left: Double) {
        self.top = top
        self.right = right
        self.bottom = bottom
        self.left = left
    }
}

public struct ChartPoint: Equatable, Sendable {
    public let x: Double
    public let y: Double

    public init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }
}

public struct Geometry: Equatable, Sendable {
    public let points: [ChartPoint?]
    /// "M0 90L150 10": a new subpath after each gap.
    public let path: String
    public let min: Double
    public let max: Double
}

private func round2(_ n: Double) -> Double { jsRound(n * 100) / 100 }

public func chartGeometry(_ values: [Double?], _ width: Double, _ height: Double, _ pad: Pad) -> Geometry {
    if values.isEmpty { return Geometry(points: [], path: "", min: 0, max: 0) }
    let present = values.compactMap { $0 }
    guard let lo = present.min(), let hi = present.max() else {
        return Geometry(points: values.map { _ in nil }, path: "", min: 0, max: 0)
    }
    let plotW = width - pad.left - pad.right
    let plotH = height - pad.top - pad.bottom
    let n = Double(values.count)
    var points: [ChartPoint?] = []
    for (i, value) in values.enumerated() {
        guard let v = value else {
            points.append(nil)
            continue
        }
        let x = n == 1 ? pad.left + plotW / 2 : pad.left + (Double(i) * plotW) / (n - 1)
        let y = hi == lo ? pad.top + plotH / 2 : pad.top + ((hi - v) / (hi - lo)) * plotH
        points.append(ChartPoint(x: round2(x), y: round2(y)))
    }
    var path = ""
    var pen = false
    for point in points {
        guard let p = point else {
            pen = false
            continue
        }
        path += (pen ? "L" : "M") + jsNumber(p.x) + " " + jsNumber(p.y)
        pen = true
    }
    return Geometry(points: points, path: path, min: lo, max: hi)
}

/// The index of the point closest to x horizontally (the first on a tie), or -1 when there is none.
public func nearestIndex(_ points: [ChartPoint?], _ x: Double) -> Int {
    var best = -1
    var bestDist = Double.infinity
    for (i, point) in points.enumerated() {
        guard let p = point else { continue }
        let d = abs(p.x - x)
        if d < bestDist {
            best = i
            bestDist = d
        }
    }
    return best
}
