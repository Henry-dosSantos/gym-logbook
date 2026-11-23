import XCTest
@testable import DossierCore

// Ports of tests/unit/chart.test.ts and tests/unit/dossier-mark.test.ts.

private let pad = Pad(top: 10, right: 0, bottom: 10, left: 0)
private func pt(_ x: Double, _ y: Double) -> ChartPoint { ChartPoint(x: x, y: y) }

final class ChartGeometryTests: XCTestCase {
    func testMapsValuesToPoints() {
        let g = chartGeometry([100, 200, 150], 300, 100, pad)
        XCTAssertEqual(g.points, [pt(0, 90), pt(150, 10), pt(300, 50)])
        XCTAssertEqual(g.path, "M0 90L150 10L300 50")
        XCTAssertEqual([g.min, g.max], [100, 200])
    }

    func testCentersAFlatSeries() {
        XCTAssertEqual(chartGeometry([5, 5], 100, 100, pad).points.map { $0?.y }, [50, 50])
    }

    func testCentersASingleValue() {
        XCTAssertEqual(chartGeometry([7], 100, 100, Pad(top: 0, right: 0, bottom: 0, left: 0)).points[0]?.x, 50)
    }

    func testHandlesEmptyInput() {
        XCTAssertEqual(chartGeometry([], 100, 100, pad).path, "")
    }

    func testLeavesGapsForNilValues() {
        let g = chartGeometry([100, nil, 200, 150], 300, 100, pad)
        XCTAssertEqual(g.points, [pt(0, 90), nil, pt(200, 10), pt(300, 50)])
        XCTAssertEqual(g.path, "M0 90M200 10L300 50")
        XCTAssertEqual([g.min, g.max], [100, 200])
    }

    func testHandlesAllNilInput() {
        let g = chartGeometry([nil, nil], 100, 100, pad)
        XCTAssertEqual(g.path, "")
        XCTAssertEqual(g.points, [nil, nil])
    }
}

final class NearestIndexTests: XCTestCase {
    func testNearest() {
        let points: [ChartPoint?] = [pt(0, 0), pt(150, 0), pt(300, 0)]
        for (x, expected) in [(74.0, 0), (80, 1), (75, 0), (-10, 0), (999, 2)] {
            XCTAssertEqual(nearestIndex(points, x), expected, "x = \(x)")
        }
    }

    func testReturnsMinusOneForNoPoints() {
        XCTAssertEqual(nearestIndex([], 5), -1)
    }

    func testSkipsNilPoints() {
        let g = chartGeometry([100, nil, 200, 150], 300, 100, pad)
        XCTAssertEqual(nearestIndex(g.points, 90), 0)
        XCTAssertEqual(nearestIndex(g.points, 110), 2)
        XCTAssertEqual(nearestIndex(g.points, 260), 3)
    }
}

final class DossierIntroTests: XCTestCase {
    func testIsAlreadyMovingAndPartlyVisibleOnTheFirstFrame() {
        let f = introAt(0)
        XCTAssertGreaterThan(f.topX, -75)
        XCTAssertLessThan(f.topX, -60)
        XCTAssertEqual(f.bottomX, -f.topX)
        XCTAssertGreaterThan(f.opacity, 0)
        XCTAssertLessThan(f.opacity, 0.5)
        XCTAssertFalse(f.done)
    }

    func testIsSolidByAbout011Seconds() {
        XCTAssertLessThan(introAt(0.09).opacity, 1)
        XCTAssertEqual(introAt(0.11).opacity, 1)
    }

    func testSlowsDownWithoutOvershootingAndLandsAt078Seconds() {
        var last = Double.infinity
        var t = 0.0
        while t < 0.78 {
            let x = introAt(t).bottomX
            XCTAssertGreaterThanOrEqual(x, 0)
            XCTAssertLessThan(x, last)
            last = x
            t += 0.01
        }
        XCTAssertFalse(introAt(0.77).done)
        let landed = introAt(0.79)
        XCTAssertEqual(landed, IntroFrame(topX: -0.0, bottomX: 0, opacity: 1, done: true))
        XCTAssertEqual(landed.topX.sign, .minus) // -0, as in the TypeScript
    }

    func testDrawsTheDCentredInTheBox() {
        XCTAssertEqual(dPath(), "M25 12.5H37.5A37.5 37.5 0 0 1 37.5 87.5H25Z")
    }
}
