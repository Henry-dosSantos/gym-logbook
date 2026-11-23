import XCTest
@testable import DossierCore

// Port of tests/unit/parse.test.ts.

private func lastLine(_ line: String) -> Line {
    let doc = parseDoc("1/1\nPush\n" + line)
    return doc.lines[doc.lines.count - 1]
}

private func show(_ w: Weight?) -> String {
    switch w {
    case nil: return "_"
    case .max?: return "max"
    case let .number(n)?: return jsNumber(n)
    }
}

/// Each set as "weight,reps" ("_" for none), standing in for the TypeScript [weight, reps] pairs.
private func pairs(_ l: Line) -> [String] {
    l.sets!.map { show($0.weight) + "," + ($0.reps.map(jsNumber) ?? "_") }
}

final class ParseExerciseLineTests: XCTestCase {
    func testParsesPlainSets() {
        let l = lastLine("Bench-310-2/285-5/275-5/")
        XCTAssertEqual(l.kind, .exercise)
        XCTAssertEqual(l.name, "Bench")
        XCTAssertEqual(pairs(l), ["310,2", "285,5", "275,5"])
        XCTAssertEqual(l.setsText, "310-2/285-5/275-5")
    }

    func testParsesPairWeights() {
        let l = lastLine("Seated Zottman curls-60s-4/55s-6/50s-7/")
        XCTAssertEqual(l.sets!.map(\.weight), [.number(60), .number(55), .number(50)])
        XCTAssertTrue(l.sets!.allSatisfy(\.pair))
        XCTAssertEqual(l.sets!.map(\.reps), [4, 6, 7])
    }

    func testParsesDurations() {
        let l = lastLine("Weighted plank-45-60s/70-60s/")
        XCTAssertEqual(l.sets!.map(\.weight), [.number(45), .number(70)])
        XCTAssertEqual(l.sets!.map(\.seconds), [60, 60])
        XCTAssertEqual(l.sets!.map(\.reps), [nil, nil])
        let w = lastLine("Static pull up hold-180-10 seconds/")
        XCTAssertEqual(w.sets![0].weight, .number(180))
        XCTAssertEqual(w.sets![0].seconds, 10)
    }

    func testShorthand() {
        let cases: [(String, Shorthand)] = [
            ("Tricep pushdowns-3x6-8/", Shorthand(sets: 3, repsMin: 6, repsMax: 8)),
            ("Tricep pushdowns-2x20/", Shorthand(sets: 2, repsMin: 20, repsMax: 20)),
            ("Tricep pushdowns-3x5-8 on max", Shorthand(sets: 3, repsMin: 5, repsMax: 8)),
            ("Tricep pushdowns-7-8x3", Shorthand(sets: 3, repsMin: 7, repsMax: 8)),
            ("Tricep pushdowns-3x-10", Shorthand(sets: 3, repsMin: nil, repsMax: 10)),
            ("Tricep pushdowns-3x12", Shorthand(sets: 3, repsMin: 12, repsMax: 12)),
            ("Tricep pushdowns-155x3", Shorthand(sets: 155, repsMin: 3, repsMax: 3)),
            ("Cable lat raises\u{2014}3x5-8/", Shorthand(sets: 3, repsMin: 5, repsMax: 8)),
        ]
        for (text, expected) in cases {
            let l = lastLine(text)
            XCTAssertEqual(l.kind, .exercise, text)
            XCTAssertEqual(l.shorthand, expected, text)
            XCTAssertEqual(l.sets, [], text)
        }
    }

    func testKeepsTheRawTextAndIgnoresParentheticals() {
        let text = "Neutral pull ups-195-3(internal bleeding under callous)/175-4/"
        let l = lastLine(text)
        XCTAssertEqual(l.text, text)
        XCTAssertEqual(pairs(l), ["195,3", "175,4"])
        XCTAssertEqual(l.setsText, "195-3/175-4")
    }

    func testHandlesOddSetTokens() {
        XCTAssertEqual(pairs(lastLine("Flat bench-285-3/275-4/315-0/"))[2], "315,0")
        XCTAssertEqual(pairs(lastLine("shrugs-360-12/360-10/360\u{2013}9/"))[2], "360,9")
        XCTAssertEqual(pairs(lastLine("Pronated pull ups-180-3/160-3/135-5:")), ["180,3", "160,3", "135,5"])
        XCTAssertEqual(lastLine("Leg press-290-10/290-/290-/").sets!.map(\.reps), [10, nil, nil])
        let max = lastLine("Calf raises-max-/max-/max-/")
        XCTAssertEqual(max.sets!.map(\.weight), [.max, .max, .max])
        XCTAssertEqual(max.sets!.map(\.reps), [nil, nil, nil])
        XCTAssertEqual(lastLine("Bench-275-3.5/245-6/").sets![0].reps, 3.5)
        let fail = lastLine("Leg extensions-230-9/230-10/230-fail + partials~12")
        XCTAssertEqual(fail.sets![2].weight, .number(230))
        XCTAssertNil(fail.sets![2].reps)
        XCTAssertEqual(fail.flags, [])
        XCTAssertEqual(pairs(lastLine("Calf raises-402.5-10/402.5-10/402.5(slow)-6/"))[2], "402.5,6")
        XCTAssertEqual(lastLine("Tricep pushdowns-max-6//max-5/max-5/").sets!.count, 3)
        let trailing = lastLine("Shrugs-max-14/max-12/max-12-")
        XCTAssertEqual(trailing.sets!.count, 3)
        XCTAssertEqual(pairs(trailing)[2], "max,12")
        XCTAssertEqual(trailing.flags, [])
        let adjusted = lastLine("Single arm cable rows-max-7/max-6/(adjusted seat back)max-7/")
        XCTAssertEqual(adjusted.sets!.map(\.weight), [.max, .max, .max])
    }

    func testFindsTheNameSeparator() {
        let barbell = lastLine("Shrugs-barbell-315-7/315-5/")
        XCTAssertEqual(barbell.name, "Shrugs-barbell")
        XCTAssertEqual(barbell.sets!.count, 2)
        let paren = lastLine("Bench(slow)275-3/255-4/")
        XCTAssertEqual(paren.name, "Bench")
        XCTAssertEqual(pairs(paren), ["275,3", "255,4"])
        XCTAssertEqual(paren.flags, [])
        XCTAssertEqual(lastLine("Tricep pushdowns(straight bar)-170-6/180-6/190-5/").name, "Tricep pushdowns")
        XCTAssertEqual(lastLine("Flat bench -275-4/245-6/225-7/").name, "Flat bench")
        let light = lastLine("Reverse ez bar curls-light-15/light-15/light-15/")
        XCTAssertEqual(light.kind, .exercise)
        XCTAssertEqual(pairs(light), ["_,15", "_,15", "_,15"])
        let sit = lastLine("Super sit ups-10/10/9/")
        XCTAssertEqual(pairs(sit), ["_,10", "_,10", "_,9"])
        let missing = lastLine("Calf raises465-14/465-14/465-12/")
        XCTAssertEqual(missing.name, "Calf raises465")
        XCTAssertEqual(missing.flags, [.missingDash])
    }

    func testTreatsTheseAsNotes() {
        let notes = [
            "Power push-doing biceps+shoulder tmw with Uncle",
            "Heavy pull-QUICK FOR MOVIE NIGHT",
            "Power push-feeling fatigued from 2 heavy exams today",
            "Heavy push - exam day, controlled session",
            "Burned about 400-450 kcal total from cycling and running on treadmill",
            "Pronated pull ups. Feeling better. Think I can do 180-4 next cycle.",
            "Heavy peloton-",
            "Db lat raises-",
            "Leg extensions",
            "BACK AT COLLEGE.",
            "# Forearms ached during curls.",
            "20 min walk",
            "8 mins",
            "3.5 mph at 6 degree incline",
            "6% incline",
            "180 degrees",
            "    55 resistance @ ~70 RPM",
        ]
        for text in notes {
            let doc = parseDoc("1/1\nPush\nBench-225-5/\n" + text)
            XCTAssertEqual(doc.lines[3].kind, .note, text)
        }
    }

    func testFlagsBadNumbersAndSets() {
        XCTAssertEqual(lastLine("Back extensions-270-6/270-5/250q-6/").flags, [.badNumber])
        XCTAssertEqual(lastLine("Back extensions-270-6q/").flags, [.badNumber])
        XCTAssertEqual(lastLine("Calf raises-3-10-13/").flags, [.badSet])
    }
}

final class ParseStructureTests: XCTestCase {
    func testParsesSupersets() {
        let doc = parseDoc("1/1\nPush\nSuperset:\n    Tricep pushdowns-175-6/175-6/\n    Db lat raises-35-10/35-9/")
        XCTAssertEqual(doc.lines.map(\.kind), [.date, .day, .superset, .exercise, .exercise])
        XCTAssertEqual(doc.lines[3].name, "Tricep pushdowns")
        XCTAssertEqual(doc.lines[4].name, "Db lat raises")
    }

    func testTakesTheDayTypeFromTheDateLine() {
        let doc = parseDoc("8/12 push at 11 pm\nBench-295-5/275-6/")
        XCTAssertEqual(doc.entries.count, 1)
        XCTAssertEqual(doc.entries[0].dayKey, "push at 11 pm")
        XCTAssertTrue(doc.entries[0].dayLine === doc.lines[0])
        XCTAssertEqual(doc.lines[1].kind, .exercise)
    }

    func testClassifiesDates() {
        let doc = parseDoc("Gym 2026\n1/1\n6/7 \n2/8/25\nPush\n10/10/9/\n40-5/40-5/")
        XCTAssertEqual(doc.year, 2026)
        XCTAssertEqual(doc.lines.map(\.kind), [.header, .date, .date, .date, .day, .note, .exercise])
        XCTAssertEqual(doc.lines[2].rest, "")
        XCTAssertEqual(doc.lines[3].year, 25)
    }

    func testNormalizesDays() {
        let cases: [(String, String?, String?)] = [
            ("Heavy push - exam day, controlled session", "Heavy push", "heavy push"),
            ("Pull. Stressed out.", "Pull", "pull"),
            ("Power push-FAST", "Power push", "power push"),
            ("Home- misc", "Home", "home"),
            ("Legs!", "Legs", "legs"),
            ("Pull ", "Pull", "pull"),
            ("(Had exam today...)", nil, nil),
        ]
        for (text, raw, key) in cases {
            XCTAssertEqual(normalizeDay(text), DayName(raw: raw, key: key), text)
        }
    }

    func testPicksTheRepeatedDayTypeAsTheDayLine() {
        let doc = parseDoc("1/1\nPull\nBench-1-1/\n\n1/2\nNote about stuff\nPull\nBench-1-1/\n\n1/3\nPull\nBench-1-1/")
        XCTAssertEqual(doc.entries[1].dayLine!.n, 7)
        XCTAssertEqual(doc.lines[5].kind, .note)
    }
}

final class ParseNeverThrowsTests: XCTestCase {
    func testRoundTripsOddInput() {
        let chars = Array("-/()x:.,;_+~*&%$#@!?<>")
        let punctuation = String((0..<200).map { chars[($0 * 7) % 22] })
        let inputs = ["", "\n\n\n", "-", "////", "((((", "1/1\n-\n/\n-5-", punctuation, "1/1\n" + punctuation]
        for (i, text) in inputs.enumerated() {
            let doc = parseDoc(text)
            XCTAssertEqual(doc.lines.map(\.text).joined(separator: "\n"), text, "input \(i)")
        }
    }
}

final class ParseContinuationTests: XCTestCase {
    func testInheritsTheNameOfANoteLine() {
        let l = lastLine("Bench-225-5/\nRDLs(grip is limiting factor for each)\n345-6/335-3(grip gave out)/315-5/")
        XCTAssertEqual(l.kind, .exercise)
        XCTAssertEqual(l.name, "RDLs")
        XCTAssertTrue(l.inherited)
        XCTAssertEqual(l.sets!.count, 3)
        XCTAssertEqual(l.flags, [])
    }

    func testInheritsFromATrailingDashName() {
        XCTAssertEqual(lastLine("Db lat raises-\n40-8/35-8/35-8/").name, "Db lat raises")
    }

    func testInheritsFromThePreviousExerciseLine() {
        let l = lastLine("Cable lat raises-40-11/(fast for next 2)\n40-5/40-5/")
        XCTAssertEqual(l.name, "Cable lat raises")
        XCTAssertTrue(l.inherited)
    }

    func testFlagsANamelessLineAfterADayLine() {
        let doc = parseDoc("1/1\nChest recov at home\n250-8/250-6/225-8/")
        let l = doc.lines[2]
        XCTAssertEqual(l.flags, [.noName])
        XCTAssertEqual(l.name, "")
    }
}

final class ParseLintTests: XCTestCase {
    func testFlagsBackwardsDatesOnce() {
        let doc = parseDoc("1/5\nA\n\n1/3\nB\n\n1/6\nC")
        XCTAssertEqual(doc.flags.map(\.line), [4])
        XCTAssertEqual(doc.flags.map(\.code), [.dateBackwards])
        XCTAssertEqual(doc.flags[0].message, "Date goes backwards")
    }

    func testTreatsAYearRolloverAsInOrder() {
        XCTAssertEqual(parseDoc("12/30\nA\n\n1/2\nB").flags, [])
    }

    func testFlagsAYearThatDiffersFromTheHeader() {
        let doc = parseDoc("Gym 2026\n2/8/25\nPush")
        XCTAssertEqual(doc.flags, [LintFlag(line: 2, code: .wrongYear, message: "Year differs from header")])
    }

    func testFlagsADayTypeUsedAsAnExerciseName() {
        let doc = parseDoc("1/1\nLegs\nBench-1-1/\n\n1/2\nLegs\nBench-1-1/\n\n1/3\nPush\nLegs-100-5/")
        XCTAssertEqual(doc.flags.map(\.line), [11])
        XCTAssertEqual(doc.flags.map(\.code), [.dayAsName])
    }
}
