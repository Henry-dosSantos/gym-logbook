import Foundation

/// Keeps each value as a file in one folder: the log as UTF-8 text, written and read back byte for byte.
/// This is the native counterpart of the web app's `platform.save` / `platform.load` (IndexedDB).
public struct TextStore: Sendable {
    public let directory: URL

    public init(directory: URL) {
        self.directory = directory
    }

    /// The app's own folder in Application Support (not visible in Files, backed up with the device).
    public static func applicationSupport(folder: String = "Dossier") throws -> TextStore {
        let base = try FileManager.default.url(
            for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true
        )
        return TextStore(directory: base.appendingPathComponent(folder, isDirectory: true))
    }

    public func url(for key: String, ext: String = "txt") -> URL {
        directory.appendingPathComponent(key).appendingPathExtension(ext)
    }

    /// Writes the text's UTF-8 bytes atomically (a crash mid-write leaves the old file in place).
    public func save(_ key: String, _ text: String) throws {
        try saveData(key, Data(text.utf8), ext: "txt")
    }

    /// The saved text, or nil when nothing was saved under `key`.
    public func load(_ key: String) throws -> String? {
        guard let data = try loadData(key, ext: "txt") else { return nil }
        return String(decoding: data, as: UTF8.self)
    }

    public func saveData(_ key: String, _ data: Data, ext: String = "json") throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try data.write(to: url(for: key, ext: ext), options: .atomic)
    }

    public func loadData(_ key: String, ext: String = "json") throws -> Data? {
        let file = url(for: key, ext: ext)
        guard FileManager.default.fileExists(atPath: file.path) else { return nil }
        return try Data(contentsOf: file)
    }
}
