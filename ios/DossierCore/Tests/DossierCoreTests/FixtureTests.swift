import XCTest
@testable import DossierCore

// Port of tests/unit/fixture.test.ts.

final class FixtureTests: XCTestCase {
    override func setUpWithError() throws { try Fixture.skipUnlessPresent() }

    private static let doc = parseDoc(Fixture.text)
    private var doc: Doc { FixtureTests.doc }
    private func line(_ n: Int) -> Line { doc.lines[n - 1] }
    private func entryAt(_ n: Int) -> Entry { doc.entries.first { $0.dateLine.n == n }! }

    func testRoundTrips() {
        XCTAssertEqual(doc.lines.count, 1447)
        XCTAssertEqual(doc.text, Fixture.text)
        XCTAssertEqual(doc.lines.map(\.text).joined(separator: "\n"), Fixture.text)
    }

    func testFindsEveryEntry() {
        let dateLine = Re(#"^[0-9]{1,2}/[0-9]{1,2}(/[0-9]{2,4})?(\s.*)?$"#)
        let dateLines = Fixture.text.jsSplit("\n").filter { dateLine.test($0) }
        XCTAssertEqual(doc.entries.count, 222)
        XCTAssertEqual(doc.entries.count, dateLines.count)
        XCTAssertEqual(doc.year, 2026)
    }

    func testFlagsTheRequiredLines() {
        let required: [(LintCode, [Int])] = [
            (.dateBackwards, [424, 431, 438, 445, 452, 459, 466, 474, 1096, 1104]),
            (.wrongYear, [192, 253]),
            (.noName, [194, 1372]),
            (.dayAsName, [1424]),
            (.badNumber, [100]),
            (.missingDash, [823]),
            (.badSet, [900]),
        ]
        for (code, lines) in required {
            for n in lines {
                XCTAssertTrue(doc.flags.contains { $0.line == n && $0.code == code }, "flags \(code.rawValue) on line \(n)")
            }
        }
    }

    func testContinuations() {
        let cases: [(Int, String)] = [
            (197, "Cable lat raises"),
            (310, "Ez bar reverse curls"),
            (1021, "Db lat raises"),
            (1099, "RDLs"),
            (1237, "Seated calf raise machine"),
            (1257, "Pronated pull ups"),
        ]
        for (n, name) in cases {
            XCTAssertEqual(line(n).kind, .exercise, "line \(n)")
            XCTAssertTrue(line(n).inherited, "line \(n)")
            XCTAssertEqual(line(n).flags, [], "line \(n)")
            XCTAssertEqual(line(n).name, name, "line \(n)")
        }
    }

    func testFindsDayLines() {
        XCTAssertEqual(entryAt(1403).dayLine?.n, 1405)
        XCTAssertEqual(entryAt(1403).dayKey, "pull")
        XCTAssertEqual(line(1404).kind, .note)
        XCTAssertEqual(entryAt(1328).dayLine?.n, 1330)
        XCTAssertEqual(entryAt(1328).dayKey, "legs")
        XCTAssertEqual(entryAt(812).dayKey, "pull")
        XCTAssertEqual(entryAt(539).dayKey, "heavy pull")
        XCTAssertEqual(entryAt(1016).dayKey, "push at 11 pm")
        XCTAssertNil(entryAt(105).dayLine)
    }

    func testHasNoFlagsBeyondTheRequiredOnes() {
        XCTAssertEqual(doc.flags.count, 18)
        XCTAssertEqual(line(687).kind, .day)
    }

    func testNoteLines() {
        for n in [366, 616, 617, 688, 689] {
            XCTAssertEqual(line(n).kind, .note, "line \(n)")
        }
    }
}
