import math

import pytest

from mapgen.config import BBox, GenerationOptions
from mapgen.errors import ValidationError
from mapgen.geo import LocalProjection, make_grid, meters_to_bbox


def test_bbox_area_and_center():
    bbox = BBox(47.220, 39.690, 47.225, 39.700)
    bbox.validate()
    assert bbox.center == pytest.approx((47.2225, 39.695))
    assert bbox.width_m > 700
    assert bbox.height_m > 500
    assert bbox.area_km2 > 0.4
    assert bbox.contains(47.2225, 39.695)
    assert not bbox.contains(47.3, 39.695)


def test_bbox_rejects_invalid_values():
    with pytest.raises(ValidationError):
        BBox(47.225, 39.690, 47.220, 39.700).validate()
    with pytest.raises(ValidationError):
        BBox(47.220, 39.700, 47.225, 39.690).validate()
    with pytest.raises(ValidationError):
        BBox(47.220, 39.690, 47.225, 200.0).validate()


def test_meters_to_bbox_size():
    bbox = meters_to_bbox(47.222, 39.710, 2000, 1000)
    assert bbox.width_m == pytest.approx(2000, abs=20)
    assert bbox.height_m == pytest.approx(1000, abs=20)
    assert bbox.center == pytest.approx((47.222, 39.710))


def test_local_projection_roundtrip():
    projection = LocalProjection(47.222, 39.710)
    x, y = projection.to_local(39.711, 47.223)
    lon, lat = projection.to_geo(x, y)
    assert lon == pytest.approx(39.711, abs=1e-9)
    assert lat == pytest.approx(47.223, abs=1e-9)


def test_grid_shape():
    bbox = BBox(47.220, 39.690, 47.225, 39.700)
    projection, grid = make_grid(bbox, 30)
    assert projection.center_lat == pytest.approx(47.2225)
    assert grid.nx >= 2
    assert grid.ny >= 2
    assert grid.xs[0] == pytest.approx(grid.x_min)
    assert grid.ys[-1] == pytest.approx(grid.y_max)
    assert math.isfinite(grid.x_max - grid.x_min)


def test_options_validation():
    bbox = BBox(47.220, 39.690, 47.225, 39.700)
    options = GenerationOptions(bbox=bbox, out_dir="out")
    options.validate()
    options.terrain_spacing = 1
    with pytest.raises(ValidationError):
        options.validate()
