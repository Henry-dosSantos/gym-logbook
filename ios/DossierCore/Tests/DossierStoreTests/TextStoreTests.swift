import XCTest
import DossierStore

// Port of tests/unit/roundtrip.test.ts (storage only: the native text view's round trip needs a device or simulator).

final class TextStoreTests: XCTestCase {
    private var store: TextStore!

    override func setUpWithError() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("dossier-tests-\(UUID().uuidString)")
        store = TextStore(directory: dir)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: store.directory)
    }

    func testKeepsAwkwardTextByteForByte() throws {
        let text = "Bench\t290-3/ \n  trailing  \nsmile \u{1F600} \u{201C}quoted\u{201D} it\u{2019}s\nno newline"
        try store.save("text", text)
        let loaded = try store.load("text")
        XCTAssertEqual(loaded, text)
        XCTAssertEqual(Array(loaded!.utf8), Array(text.utf8))
        XCTAssertEqual(try Data(contentsOf: store.url(for: "text")), Data(text.utf8))
    }

    func testKeepsCarriageReturnsAndABOM() throws {
        let text = "\u{FEFF}1/1\r\nPush\r\n"
        try store.save("text", text)
        XCTAssertEqual(Array(try store.load("text")!.utf8), Array(text.utf8))
    }

    func testReturnsNilForAMissingKey() throws {
        XCTAssertNil(try store.load("missing"))
    }

    func testFixtureSurvivesStorage() throws {
        var repo = URL(fileURLWithPath: #filePath)
        for _ in 0..<5 { repo.deleteLastPathComponent() }
        let fixture = ProcessInfo.processInfo.environment["DOSSIER_FIXTURE"].map { URL(fileURLWithPath: $0) }
            ?? repo.appendingPathComponent("tests/fixtures/gym-2026.txt")
        try XCTSkipUnless(FileManager.default.fileExists(atPath: fixture.path), "tests/fixtures/gym-2026.txt is absent")
        let bytes = try Data(contentsOf: fixture)
        let text = String(decoding: bytes, as: UTF8.self)
        try store.save("text", text)
        XCTAssertEqual(try store.load("text"), text)
        XCTAssertEqual(try Data(contentsOf: store.url(for: "text")), bytes)
    }
}
