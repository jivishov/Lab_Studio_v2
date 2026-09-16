from __future__ import annotations

from PIL import Image, ImageDraw

from generateSimulatorTechniqueAssets import asset, write_asset


# These values are deliberately kept with the generator and tested alongside the output.  The
# probe crop is a direct extraction from the approved pH-meter master; the detached-console state
# only clears the parked electrode and its short lead, leaving every other source pixel intact.
PROBE_CROP = (955, 220, 1090, 1100)
def detached_console(master: Image.Image) -> Image.Image:
    result = master.copy()
    clear = Image.new("L", result.size, 0)
    draw = ImageDraw.Draw(clear)

    # The parked electrode occupies the right-hand cradle.  A soft join removes only that hardware
    # and the visible lead, so the meter body and screen retain their original pixels.
    draw.rounded_rectangle((890, 210, 1090, 1090), radius=46, fill=255)
    draw.line(
        [(770, 220), (825, 128), (947, 90), (1035, 165), (1010, 286)],
        fill=255,
        width=42,
        joint="curve",
    )
    alpha = result.getchannel("A")
    alpha.paste(0, mask=clear)
    result.putalpha(alpha)
    return result


def probe(master: Image.Image) -> Image.Image:
    crop = master.crop(PROBE_CROP)
    keep = Image.new("L", crop.size, 0)
    draw = ImageDraw.Draw(keep)

    # Preserve the actual electrode head and glass sensing shaft.  The white docking cradle and
    # console edge remain transparent so the movable result reads as the probe itself, not a crop
    # of the parked instrument.
    draw.rounded_rectangle((24, 0, 132, 286), radius=28, fill=255)
    # A narrow alpha-only extraction follows the glass shaft through the docking cradle, removing
    # the surrounding white holder without synthesising or repainting any probe pixels.
    draw.rounded_rectangle((60, 260, 101, 880), radius=16, fill=255)
    alpha = crop.getchannel("A")
    alpha = Image.composite(alpha, Image.new("L", crop.size, 0), keep)
    crop.putalpha(alpha)
    return crop


def main() -> None:
    master = asset("ph-meter")
    write_asset("ph-meter-probe", "pH meter probe", probe(master))
    write_asset("ph-meter-probe-detached-console", "pH meter console with probe removed", detached_console(master))


if __name__ == "__main__":
    main()
