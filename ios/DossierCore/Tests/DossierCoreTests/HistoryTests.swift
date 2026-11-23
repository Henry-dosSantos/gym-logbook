import XCTest
@testable import DossierCore

// Ports of tests/unit/related.test.ts and tests/unit/checkpoint3.test.ts.

private func ghostAt(_ text: String, _ date: Date) -> String? {
    suggest(parseDoc(text), text.utf16.count, defaultSettings, date).ghost?.text
}

final class RelatedTests: XCTestCase {
    func testRelated() {
        let cases: [(String, String, Bool)] = [
            ("Chin ups", "Weighted chin ups", true),
            ("Weighted chin ups", "Chin ups", true),
            ("Calf raises", "Seated calf raises", true),
            ("Shrugs", "Shrugs-barbell", true),
            ("Bench", "Incline db", false),
            ("Leg curls", "Leg extensions", false),
            ("Db lat raise", "Incline db", false),
            ("Bench", "bench", true),
        ]
        for (a, b, expected) in cases {
            XCTAssertEqual(related(a, b), expected, "\(a) / \(b)")
        }
    }

    func testSuggestionsSkipRelatedExercises() {
        let date = local(2026, 1, 5, 10)
        let base = "1/1\nPull\nChin ups-180-3/\nRows-300-8/\n\n1/5\nPull\nWeighted chin ups-190-3/\n"
        XCTAssertEqual(ghostAt(base, date), "Rows")
        XCTAssertNil(ghostAt(base + "Rows-300-8/\n", date))
    }
}

final class RelatedFixtureTests: XCTestCase {
    override func setUpWithError() throws { try Fixture.skipUnlessPresent() }

    private let yesterday = local(2026, 11, 22, 10)

    func testSkipsTheRelatedExerciseOnAnEmptyLine() {
        XCTAssertNil(ghostAt(Fixture.text + "\n", yesterday))
        XCTAssertNil(ghostAt(Fixture.text + "\n", local(2026, 11, 23, 1)))
    }

    func testSkipsRelatedNamesWhileTypingAPrefix() {
        XCTAssertEqual(ghostAt(Fixture.text + "\nC", yesterday), "alf raise machine")
    }

    func testStillGivesWeightsForAnExactName() {
        XCTAssertEqual(ghostAt(Fixture.text + "\nChin ups", yesterday), "-180")
    }
}

private let lastEntry =
    "11/22\nPull\nWeighted chin ups-200-2/180-4/\nUnderhand rows-370-6/370-6/370-5/\nHammer curls-75-4/70-5/"

final class TodayTextTests: XCTestCase {
    private let text = "1/1\nPush\nBench-1-1/\n\n1/2\nPull\nRows-1-1/\n\n"

    func testPrefersTheEntryDatedToday() {
        XCTAssertEqual(todayText(parseDoc(text), local(2026, 1, 1)), "1/1\nPush\nBench-1-1/")
    }

    func testFallsBackToTheLastEntry() {
        XCTAssertEqual(todayText(parseDoc(text), local(2026, 1, 5)), "1/2\nPull\nRows-1-1/")
    }

    func testIsNilWithoutEntries() {
        XCTAssertNil(todayText(parseDoc(""), local(2026, 1, 1)))
    }

    func testUsesTheFixtureEntry() throws {
        try Fixture.skipUnlessPresent()
        let doc = parseDoc(Fixture.text)
        XCTAssertEqual(todayText(doc, local(2026, 11, 22)), lastEntry)
        XCTAssertEqual(todayText(doc, local(2026, 11, 23)), lastEntry)
    }
}

final class ExerciseListTests: XCTestCase {
    override func setUpWithError() throws { try Fixture.skipUnlessPresent() }

    func testListsUsableExercises() {
        let list = exerciseList(parseDoc(Fixture.text), defaultSettings.aliases)
        XCTAssertTrue(list.contains(ExerciseSummary(key: "bench", name: "Bench", sessions: 59)))
        XCTAssertTrue(list.contains(ExerciseSummary(key: "calf raises", name: "Calf raises", sessions: 35)))
        XCTAssertFalse(list.contains { $0.key == "lat pull downs" })
        XCTAssertEqual(list.first?.key, "bench")
    }
}
