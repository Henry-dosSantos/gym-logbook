import XCTest
@testable import DossierCore

// Port of tests/unit/suggest.test.ts.

private let today = local(2026, 11, 23, 10)

private func ghostAt(_ text: String, _ settings: Settings = defaultSettings, _ date: Date = today) -> Ghost? {
    suggest(parseDoc(text), text.utf16.count, settings, date).ghost
}

private func ghostText(_ text: String, _ settings: Settings = defaultSettings) -> String? {
    ghostAt(text, settings)?.text
}

private func sessionsDoc(_ lines: [String], _ next: String) -> String {
    let entries = lines.enumerated().map { i, l in "1/\(1 + i * 2)\nPush\n\(l)\n" }
    return entries.joined(separator: "\n") + "\n1/\(1 + lines.count * 2)\nPush\n\(next)"
}

private func nameOf(_ sessions: [String]) -> String { sessions[0].jsSplit("-")[0] }

private func settings(defaults: ExerciseSetting? = nil, exercises: [String: ExerciseSetting] = [:]) -> Settings {
    Settings(aliases: defaultSettings.aliases, exercises: exercises, defaults: defaults)
}

final class WeightProgressionTests: XCTestCase {
    func testProgression() {
        let cases: [([String], String)] = [
            (["Bench-300-4/", "Bench-300-5/"], "-305"),
            (["Bench-300-4/", "Bench-300-3/"], "-300"),
            (["Bench-295-4/", "Bench-300-4/"], "-300"),
            (["X-max-8/", "X-max-9/"], "-max"),
            (["Calf raises-410-10/", "Calf raises-410-11/"], "-415"),
            (["Calf raises-410-10/", "Calf raises-410-9/"], "-415"),
            (["Calf raises-410-5/", "Calf raises-410-6/"], "-415"),
            (["X-84-6/", "X-92.5-3/", "X-91-5/", "X-91-5/"], "-92.5"),
            (["Bench-300-4/", "Bench-300-5/", "Bench-3x5/"], "-305"),
            (["X-190-3/", "X-180-4/", "X-180-4/"], "-185"),
            (["X-84-5/", "X-91-3/", "X-84-5/", "X-84-5/"], "-91"),
            (["Sit ups-45-8/", "Sit ups-45-8/"], "-50"),
            (["X-45-4/", "X-45-3/"], "-45"),
            (["X-402.5-10/", "X-402.5-10/"], "-407.5"),
        ]
        for (sessions, expected) in cases {
            XCTAssertEqual(ghostText(sessionsDoc(sessions, nameOf(sessions))), expected, "\(sessions)")
        }
    }

    func testHonoursSettingsOverrides() {
        let sessions = ["Bench-300-4/", "Bench-300-5/"]
        let inc = settings(exercises: ["bench": ExerciseSetting(increment: 10)])
        let tgt = settings(exercises: ["bench": ExerciseSetting(target: 6)])
        XCTAssertEqual(ghostText(sessionsDoc(sessions, "Bench"), inc), "-310")
        XCTAssertEqual(ghostText(sessionsDoc(sessions, "Bench"), tgt), "-300")
    }

    func testSuggestsLaterSetsFromTheLastSession() {
        let s = ["Bench-300-3/280-5/260-8/"]
        XCTAssertEqual(ghostText(sessionsDoc(s, "Bench-300-3/")), "280")
        XCTAssertNil(ghostText(sessionsDoc(s, "Bench-300-3/280-5/260-8/")))
    }

    func testKeepsThePairSuffix() {
        let s = ["Curls-60s-4/55s-6/"]
        XCTAssertEqual(ghostText(sessionsDoc(s, "Curls")), "-60s")
        XCTAssertEqual(ghostText(sessionsDoc(s, "Curls-60s-4/")), "55s")
    }
}

final class NextExerciseTests: XCTestCase {
    func testNextExerciseAfterABlankLine() {
        let date = local(2026, 1, 5, 10)
        let base = "1/1\nPush\nBench-225-5/\nIncline db-80-8/\n\n1/5\nPush\n"
        let flat = "1/1\nPush\nBench-225-5/\n\n1/5\nPush\n\n"
        let cases: [(String, String?)] = [
            (base, "Bench"),
            (base + "Bench-225-5/\n", "Incline db"),
            (base + "Bench-225-5/\n\n", nil),
            (flat, nil),
            (flat + "B", "ench"),
        ]
        for (text, expected) in cases {
            XCTAssertEqual(ghostAt(text, defaultSettings, date)?.text, expected, text)
        }
    }
}

final class GlobalRuleTests: XCTestCase {
    func testGlobalRule() {
        let two = ["Bench-300-4/", "Bench-300-5/"]
        let cases: [([String], Settings, String)] = [
            (two, settings(defaults: ExerciseSetting(target: 5)), "-300"),
            (two, settings(defaults: ExerciseSetting(increment: 10)), "-310"),
            (two, settings(defaults: ExerciseSetting(increment: 10), exercises: ["bench": ExerciseSetting(increment: 2.5)]),
             "-302.5"),
            (two, settings(defaults: ExerciseSetting(target: 6), exercises: ["bench": ExerciseSetting(target: 4)]), "-305"),
            (["X-84-6/", "X-92.5-3/", "X-91-5/", "X-91-5/"], settings(defaults: ExerciseSetting(increment: 10)), "-92.5"),
        ]
        for (sessions, s, expected) in cases {
            XCTAssertEqual(ghostText(sessionsDoc(sessions, nameOf(sessions)), s), expected, "\(sessions) \(s)")
        }
    }
}

final class DayTypePredictionTests: XCTestCase {
    private func log(_ names: [String]) -> String {
        names.enumerated().map { i, d in "1/\(i + 1)\n\(d)\nBench-1-1/" }.joined(separator: "\n\n")
    }

    private let days = ["Push", "Legs", "Pull", "Push", "Legs", "Pull", "Push", "Pull", "Legs"]
    private var doc: Doc { parseDoc(log(days)) }

    private func dayGhost(_ names: [String], _ typed: String = "") -> String? {
        let text = "\(log(names))\n\n2/1\n\(typed)"
        return suggest(parseDoc(text), text.utf16.count, defaultSettings, local(2026, 2, 1)).ghost?.text
    }

    func testPredictsTheDayTypeDoneLongestAgo() {
        XCTAssertEqual(dayGhost(["Push", "Pull", "Legs"]), "Push")
        XCTAssertEqual(dayGhost(["Push", "Pull", "Legs", "Push"]), "Pull")
        XCTAssertEqual(nextInRotation(doc, 9, ""), "push")
        XCTAssertEqual(rankDayTypes(doc, 9, "legs", "").first, "push")
    }

    func testNarrowsToWhatIsTyped() {
        XCTAssertEqual(dayGhost(["Push", "Pull", "Legs", "Push"], "P"), "ull")
        XCTAssertEqual(dayGhost(["Push", "Legs", "Pull"], "P"), "ush")
        XCTAssertEqual(dayGhost(["Push", "Pull", "Legs", "Push"], "L"), "egs")
        XCTAssertEqual(rankDayTypes(doc, 7, "pull", "p").first, "pull")
        XCTAssertEqual(rankDayTypes(doc, 8, "push", "p").first, "push")
        XCTAssertEqual(rankDayTypes(doc, 9, "legs", "pul"), ["pull"])
    }

    func testCountsVariantsAsTheirBaseDayType() {
        XCTAssertEqual(nextInRotation(parseDoc(log(["Push", "Pull", "Push", "Pull", "Push at 11 pm", "Legs"])), 6, "p"), "pull")
        XCTAssertEqual(nextInRotation(parseDoc(log(["Push", "Pull", "Legs", "Heavy push", "Pull at home"])), 5, ""), "legs")
    }

    func testOnlyPicksBetweenPushPullAndLegs() {
        XCTAssertEqual(nextInRotation(parseDoc(log(["Push", "Bjj", "Pull"])), 3, ""), "push")
        XCTAssertEqual(nextInRotation(parseDoc(log(["Legs", "Push", "Pull", "Bjj", "Walk"])), 5, ""), "legs")
        XCTAssertNil(dayGhost(["Back", "Chest"]))
    }

    func testCountsALegsDayThatHasNoDayLine() {
        let legs = "11/17\nLegs-405-2/365-6/365-3/\nLeg curls-245-4/235-4/235-4/"
        let pull = "11/18\nPull at 11:35. Had 25 minutes\nWeighted chin ups-190-3/"
        let push = "11/21\nPush\nBench-290-3/"
        let pull2 = "11/22\nPull\nHammer curls-75-4/70-5/"
        let block = [legs, pull, push, pull2].joined(separator: "\n\n")
        let text = block + "\n" + block + "\n\n11/23\n"
        XCTAssertEqual(suggest(parseDoc(text), text.utf16.count, defaultSettings, local(2026, 11, 23)).ghost?.text, "Legs")
    }

    func testShowsNothingOnABlankLog() {
        XCTAssertNil(nextInRotation(parseDoc(""), 0, ""))
    }
}

final class FixtureSuggestionTests: XCTestCase {
    override func setUpWithError() throws { try Fixture.skipUnlessPresent() }

    private var F: String { Fixture.text }
    private var B: String { F + "\n\n11/23\nPush\n" }
    private let bench = [
        StripItem(date: "11/21", sets: "290-3/270-5/245-9"),
        StripItem(date: "11/13", sets: "290-3/265-6"),
    ]

    private func g(_ text: String, _ kind: GhostKind, _ space: Bool) -> Ghost { Ghost(text: text, kind: kind, space: space) }

    func testGhosts() {
        let full = B + "Bench-290-4/270-5/245-9/\nIncline db-105-5/\nDb lat raise-40-9/40-8/\nTricep pushdowns-max-8/max-7/max-6/\n"
        let cases: [(String, Ghost?)] = [
            (F + "\n", nil),
            (F + "\n\n", g("11/23", .date, false)),
            (F + "\n\n1", g("1/23", .date, false)),
            (F + "\n\n11/23", nil),
            (F + "\n\n11/23\n", g("Legs", .day, false)),
            (F + "\n\n11/23\nP", g("ush", .day, false)),
            (F + "\n\n11/23\nPush", nil),
            (B, g("Bench", .name, false)),
            (B + "B", g("ench", .name, false)),
            (B + "Inc", g("line db", .name, false)),
            (B + "T", g("ricep pushdowns", .name, false)),
            (B + "Bench", g("-290", .weight, false)),
            (B + "Bench-", g("290", .weight, true)),
            (B + "Bench-2", g("90", .weight, true)),
            (B + "Bench-290", g("-", .dash, true)),
            (B + "Bench-285", g("-", .dash, true)),
            (B + "Bench-290-", nil),
            (B + "Bench-290-4", g("/", .slash, true)),
            (B + "Bench-290-4/", g("270", .weight, true)),
            (B + "Bench-290-4/270-5/", g("245", .weight, true)),
            (B + "Bench-290-4/270-5/245-9/", nil),
            (B + "Bench-290-4/270-5/245-9/\n", g("Incline db", .name, false)),
            (B + "Bench-290-4/270-5/245-9/\nIncline db", g("-105", .weight, false)),
            (B + "Bench-290-4/270-5/245-9/\nIncline db-105-5/", nil),
            (B + "Bench-290-4/270-5/245-9/\nIncline db-105-5/\n", g("Db lat raise", .name, false)),
            (B + "Db lat raise", g("-40", .weight, false)),
            (B + "Db lat raise-40-9/", g("40", .weight, true)),
            (B + "Db lat raise-40-9/40-8/", nil),
            (B + "Tricep pushdowns", g("-max", .weight, false)),
            (B + "Tricep pushdowns-m", g("ax", .weight, true)),
            (B + "Tricep pushdowns-max-8/", g("max", .weight, true)),
            (B + "Tricep pushdowns-max-8/max-7/max-6/", nil),
            (full, nil),
        ]
        for (i, (text, expected)) in cases.enumerated() {
            XCTAssertEqual(ghostAt(text), expected, "ghost for case \(i)")
        }
    }

    func testSuggestsAnExerciseOnlyInAnActiveEntry() {
        XCTAssertNil(ghostAt(F + "\n", defaultSettings, local(2026, 11, 22, 10)))
        XCTAssertNil(ghostAt(F + "\n\n", defaultSettings, local(2026, 11, 22, 10)))
        XCTAssertNil(ghostAt(F + "\n", defaultSettings, local(2026, 11, 23, 1)))
        XCTAssertNil(ghostAt(F + "\n", defaultSettings, local(2026, 11, 23, 4)))
        XCTAssertNil(ghostAt(F + "\n ", defaultSettings, local(2026, 11, 22, 10)))
    }

    func testRanksDayTypes() {
        XCTAssertEqual(rankDayTypes(parseDoc(F), 222, "pull", "p").first, "push")
    }

    func testFillsTheStrip() {
        for text in [B + "Bench", B + "Bench-290-4/"] {
            XCTAssertEqual(suggest(parseDoc(text), text.utf16.count, defaultSettings, today).strip, bench)
        }
        let text = B + "Bench"
        let s = suggest(parseDoc(text), text.utf16.count - 1, defaultSettings, today)
        XCTAssertNil(s.ghost)
        XCTAssertEqual(s.strip, bench)
    }

    func testShowsTheStripAtTheEndOfTheUnmodifiedFixture() {
        let s = suggest(parseDoc(F), F.utf16.count, defaultSettings, today)
        XCTAssertNil(s.ghost)
        XCTAssertEqual(s.strip, [
            StripItem(date: "11/18", sets: "75-5/70-5"),
            StripItem(date: "11/12", sets: "75-6/75-4/70-6"),
        ])
    }
}
