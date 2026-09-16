from __future__ import annotations

from PIL import Image

from generateSimulatorTechniqueAssets import asset, paste_fit, write_asset


CANVAS_SIZE = (1024, 1504)
SCALE = 3.2


def scaled_box(x: float, y: float, width: float, height: float) -> tuple[int, int, int, int]:
    return tuple(round(value * SCALE) for value in (x, y, width, height))


def titration_stand(include_funnel: bool) -> Image.Image:
    canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    paste_fit(canvas, asset("ring-stand-clamp"), (0, 0, *CANVAS_SIZE))
    paste_fit(canvas, asset("burette-50ml"), scaled_box(181, 28, 64, 250))
    if include_funnel:
        paste_fit(canvas, asset("funnel"), scaled_box(184, 0, 59, 88))
    return canvas


def main() -> None:
    write_asset(
        "ring-stand-burette",
        "ring stand and clamp with burette",
        titration_stand(False),
    )
    write_asset(
        "ring-stand-burette-funnel",
        "ring stand and clamp with burette and filling funnel",
        titration_stand(True),
    )


if __name__ == "__main__":
    main()
