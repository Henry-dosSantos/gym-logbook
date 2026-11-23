import XCTest
@testable import DossierCore

// Ports of tests/unit/settings.test.ts and tests/unit/stats.test.ts. The effectiveTopInset cases in
// settings.test.ts test the web app's src/viewport.ts (a browser workaround), so they have no Swift counterpart.

final class SettingsTests: XCTestCase {
    func testSetsAndClearsTheGlobalRule() {
        let s = setGlobal(defaultSettings, .target, 6)
        XCTAssertEqual(s.defaults, ExerciseSetting(target: 6))
        XCTAssertEqual(globalRule(s), Rule(target: 6, increment: 5))
        XCTAssertNil(setGlobal(s, .target, 4).defaults)
    }

    func testSetsPerExerciseRulesAgainstTheGlobalRule() {
        let s2 = setExerciseRule(defaultSettings, "bench", .increment, 10)
        XCTAssertEqual(exerciseRule(s2, "bench"), ExerciseRule(target: 4, increment: 10, custom: true))
        XCTAssertEqual(exerciseRule(s2, "rows"), ExerciseRule(target: 4, increment: 5, custom: false))
        XCTAssertNil(setExerciseRule(s2, "bench", .increment, 5).exercises["bench"])
        XCTAssertNil(clearExerciseRule(s2, "bench").exercises["bench"])
    }

    func testCleansAliasGroups() {
        let s = setAliasGroups(defaultSettings, [[" A ", "B", ""], ["solo"], ["", " "]])
        XCTAssertEqual(s.aliases, [["A", "B"]])
    }

    func testNeverMutatesItsInput() {
        let s = setExerciseRule(setGlobal(defaultSettings, .target, 6), "bench", .target, 8)
        let copy = s
        _ = setGlobal(s, .increment, 10)
        _ = setExerciseRule(s, "bench", .increment, 10)
        _ = setExerciseRule(s, "rows", .target, 3)
        _ = clearExerciseRule(s, "bench")
        _ = setAliasGroups(s, [["a", "b"]])
        XCTAssertEqual(s, copy)
    }

    func testClearsEveryExerciseRuleWithoutMutating() {
        let s = Settings(aliases: defaultSettings.aliases, exercises: ["bench": ExerciseSetting(target: 5)])
        let copy = s
        XCTAssertEqual(clearAllExerciseRules(s).exercises, [:])
        XCTAssertEqual(s, copy)
    }

    func testReadsTheWebAppsSettingsJSON() throws {
        let json = #"{"aliases":[["Bench","Flat bench"]],"exercises":{"bench":{"increment":2.5}},"defaults":{"target":6}}"#
        let s = try JSONDecoder().decode(Settings.self, from: Data(json.utf8))
        XCTAssertEqual(s.aliases, [["Bench", "Flat bench"]])
        XCTAssertEqual(s.exercises["bench"], ExerciseSetting(increment: 2.5))
        XCTAssertEqual(s.defaults, ExerciseSetting(target: 6))
    }
}

final class Estimate1RMTests: XCTestCase {
    func testEstimates() {
        for (w, r, expected) in [(290.0, 3.0, 316.04), (270, 5, 314.77), (245, 9, 321.55)] {
            XCTAssertEqual(estimate1RM(w, r)!, expected, accuracy: 0.05, "(\(w), \(r))")
        }
    }

    func testReturnsTheWeightForASingle() {
        XCTAssertEqual(estimate1RM(300, 1), 300)
    }

    func testRejects() {
        for (w, r) in [(300.0, 0.0), (300, 0.5), (0, 5)] {
            XCTAssertNil(estimate1RM(w, r), "(\(w), \(r))")
        }
    }

    func testInterpolatesFractionalReps() {
        let mid = estimate1RM(225, 3.5)!
        XCTAssertGreaterThan(mid, estimate1RM(225, 3)!)
        XCTAssertLessThan(mid, estimate1RM(225, 4)!)
    }
}

final class ExerciseSeriesTests: XCTestCase {
    private let aliases = defaultSettings.aliases

    func testReadsSetOneOfEachSession() {
        let series = exerciseSeries(parseDoc("1/1\nPush\nBench-225-3/\n\n1/2\nPush\nBench-max-9/\n\n1/3\nPush\nBench-230-/"),
                                    "bench", aliases)
        XCTAssertEqual(series.map(\.weight), [225, nil, 230])
        XCTAssertEqual(series.map(\.max), [false, true, false])
        XCTAssertEqual(series.map(\.reps), [3, 9, nil])
        XCTAssertEqual(metricPoints(series, .weight).count, 2)
        XCTAssertEqual(metricPoints(series, .reps).count, 2)
    }

    func testEstimatesFromTheBestSet() {
        let s = exerciseSeries(parseDoc("1/1\nPush\nBench-290-3/270-5/245-9/\n\n1/2\nPush\nBench-max-9/"), "bench", aliases)
        XCTAssertEqual(s[0].oneRm!, 321.55, accuracy: 0.05)
        XCTAssertEqual(s[0].oneRmFrom, OneRmSource(weight: 245, reps: 9))
        XCTAssertNil(s[1].oneRm)
    }

    func testDashboardLatestText() {
        let cases: [(String, String)] = [
            ("Bench-290-3/", "290 × 3"),
            ("Bench-max-10/", "max × 10"),
            ("Bench-290-/", "290"),
            ("Bench-10/", "× 10"),
        ]
        for (text, expected) in cases {
            let items = dashboardItems(parseDoc("1/1\nPush\nBench-100-5/\n\n1/2\nPush\n\(text)"), aliases)
            XCTAssertEqual(items.first?.latestText, expected, text)
        }
    }
}

final class DashboardFixtureTests: XCTestCase {
    override func setUpWithError() throws { try Fixture.skipUnlessPresent() }

    private static let items = dashboardItems(parseDoc(Fixture.text), defaultSettings.aliases)

    func testSummarizesBench() {
        let bench = Self.items[0]
        XCTAssertEqual(bench.key, "bench")
        XCTAssertEqual(bench.sessions, 59)
        XCTAssertEqual(bench.latestText, "290 × 3")
        XCTAssertEqual(bench.oneRmLatest?.rounded(), 322)
        XCTAssertEqual(bench.spark.count, 59)
        XCTAssertEqual(bench.spark[0], 225)
    }

    func testHandlesMaxWeightExercises() {
        let legExt = Self.items.first { $0.key == "leg extensions" }!
        XCTAssertEqual(legExt.latestText, "max × 10")
        XCTAssertEqual(legExt.oneRmSpark.compactMap { $0 }.count, 3)
        XCTAssertFalse(Self.items.contains { $0.key == "lat pull downs" })
    }
}
