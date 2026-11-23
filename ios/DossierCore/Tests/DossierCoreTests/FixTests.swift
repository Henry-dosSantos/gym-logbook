import XCTest
@testable import DossierCore

// Port of tests/unit/fix.test.ts.

final class SuggestFixSyntheticTests: XCTestCase {
    func testRollsABackwardsDateIntoTheNextMonth() {
        let doc = parseDoc("Gym 2026\n12/30\nPush\n\n12/1\nPush\n")
        XCTAssertEqual(doc.flags.map(\.line), [5])
        XCTAssertEqual(doc.flags.map(\.code), [.dateBackwards])
        XCTAssertEqual(suggestFix(doc, doc.lines[4]), "1/1")
    }

    func testKeepsTheRestOfADateLine() {
        let doc = parseDoc("8/31\nPush\n\n8/12 push at 11 pm\nBench-1-1/")
        XCTAssertEqual(suggestFix(doc, doc.lines[3]), "9/12 push at 11 pm")
    }

    func testOffersNothingWhenNoHistoryMatches() {
        let doc = parseDoc("1/1\nPush\nBench-225-5/\n\n1/2\nPush\n999-8/")
        XCTAssertTrue(doc.flags.contains { $0.code == .noName })
        XCTAssertNil(suggestFix(doc, doc.lines[6]))
    }
}

final class SuggestFixFixtureTests: XCTestCase {
    override func setUpWithError() throws { try Fixture.skipUnlessPresent() }

    private static let doc = parseDoc(Fixture.text)
    private func fix(_ n: Int) -> String? { suggestFix(Self.doc, Self.doc.lines[n - 1]) }

    func testFixes() {
        let cases: [(Int, String)] = [
            (100, "Back extensions-270-6/270-5/250-6/"),
            (192, "2/8"),
            (253, "2/22"),
            (424, "4/1"),
            (431, "4/2"),
            (438, "4/6"),
            (445, "4/7"),
            (452, "4/9"),
            (459, "4/11"),
            (466, "4/13"),
            (474, "4/15"),
            (823, "Calf raises-465-14/465-14/465-12/"),
            (900, "Calf raises-3x10-13/"),
            (1096, "9/1"),
            (1104, "9/3"),
        ]
        for (n, expected) in cases {
            XCTAssertEqual(fix(n), expected, "line \(n)")
        }
    }

    func testPredictions() {
        let cases: [(Int, String)] = [
            (194, "Bench-250-8/250-6/225-8/"),
            (1372, "Neutral pull ups-205-2/180-2/"),
            (1424, "Rdls-405-2/365-6/365-3/"),
        ]
        for (n, expected) in cases {
            XCTAssertEqual(fix(n), expected, "prediction for line \(n)")
        }
    }

    func testClearsEveryFlagWhenAllFixesAreApplied() {
        var lines = Fixture.text.jsSplit("\n")
        let flagLines = Set(Self.doc.flags.map(\.line))
        for flagLine in flagLines {
            guard let fixed = fix(flagLine) else {
                XCTFail("no fix for line \(flagLine)")
                continue
            }
            lines[flagLine - 1] = fixed
        }
        XCTAssertEqual(flagLines.count, 18)
        XCTAssertEqual(parseDoc(lines.joined(separator: "\n")).flags, [])
    }
}
