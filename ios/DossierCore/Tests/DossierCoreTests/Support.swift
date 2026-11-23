import Foundation
import XCTest

/// Henry's private log, read from the web app's tests/fixtures/gym-2026.txt (gitignored). Tests that need it skip
/// when it is absent. Set DOSSIER_FIXTURE to read it from somewhere else. Never copy it into this package.
enum Fixture {
    static let url: URL = {
        if let path = ProcessInfo.processInfo.environment["DOSSIER_FIXTURE"] { return URL(fileURLWithPath: path) }
        // <repo>/ios/DossierCore/Tests/DossierCoreTests/Support.swift -> <repo>
        var repo = URL(fileURLWithPath: #filePath)
        for _ in 0..<5 { repo.deleteLastPathComponent() }
        return repo.appendingPathComponent("tests/fixtures/gym-2026.txt")
    }()

    static var exists: Bool { FileManager.default.fileExists(atPath: url.path) }

    /// The fixture's text with every byte kept (a BOM or "\r" stays, as with Node's readFileSync).
    static let text: String = {
        guard let data = try? Data(contentsOf: url) else { return "" }
        return String(decoding: data, as: UTF8.self)
    }()

    static func skipUnlessPresent() throws {
        try XCTSkipUnless(exists, "tests/fixtures/gym-2026.txt is absent")
    }
}

/// A local date and time. The month is 1-based: JavaScript's new Date(2026, 10, 23, 10) is local(2026, 11, 23, 10).
func local(_ year: Int, _ month: Int, _ day: Int, _ hour: Int = 0) -> Date {
    Calendar.current.date(from: DateComponents(year: year, month: month, day: day, hour: hour))!
}
