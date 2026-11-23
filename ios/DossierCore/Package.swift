// swift-tools-version:5.9
import PackageDescription

// DossierCore: the pure logic of Dossier, ported from the web app's src/core (parse, history, suggest, fix,
// settings, stats, onerm, chart, dossier-mark). No UIKit, no storage.
// DossierStore: saving and loading the log text as a file, byte for byte. Foundation only.
let package = Package(
    name: "DossierCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "DossierCore", targets: ["DossierCore"]),
        .library(name: "DossierStore", targets: ["DossierStore"]),
    ],
    targets: [
        .target(name: "DossierCore"),
        .target(name: "DossierStore"),
        .testTarget(name: "DossierCoreTests", dependencies: ["DossierCore"]),
        .testTarget(name: "DossierStoreTests", dependencies: ["DossierStore"]),
    ]
)
