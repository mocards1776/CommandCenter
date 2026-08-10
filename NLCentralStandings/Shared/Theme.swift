import SwiftUI

/// Franchise accents for the NL Central — used as a thin leading bar.
enum TeamPalette {
    static func accent(for teamId: Int) -> Color {
        switch teamId {
        case 158: return Color(hex: 0xFFC52F) // Brewers gold
        case 112: return Color(hex: 0x0E3386) // Cubs blue
        case 138: return Color(hex: 0xC41E3A) // Cardinals red
        case 134: return Color(hex: 0xFDB827) // Pirates gold
        case 113: return Color(hex: 0xC6011F) // Reds red
        default: return Scoreboard.accent
        }
    }
}

/// Matches CommandCenter Fenway / scoreboard tokens.
enum Scoreboard {
    static let ink = Color(hex: 0x081228)
    static let field = Color(hex: 0x0A1730)
    static let panel = Color(hex: 0x0D1D3C)
    static let hero = Color(hex: 0x16294F)
    static let accent = Color(hex: 0xD9515C)
    static let accentDeep = Color(hex: 0xC0303B)
    static let turf = Color(hex: 0x3D9B6E)
    static let cream = Color(hex: 0xF4F1E9)
    static let chalk = Color.white.opacity(0.55)
    static let chalkDim = Color.white.opacity(0.30)
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >> 8) & 0xFF) / 255
        let b = Double(hex & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)
    }
}
