import numpy as np
import pytest

from mapgen.config import BBox, GenerationOptions
from mapgen.elevation import smooth_elevations
from mapgen.errors import ValidationError


def test_smooth_elevations_preserves_flat_surface():
    data = np.full((8, 9), 123.0)
    result = smooth_elevations(data, 2)
    assert np.allclose(result, 123.0)


def test_smooth_elevations_reduces_single_spike():
    data = np.zeros((9, 9))
    data[4, 4] = 100.0
    once = smooth_elevations(data, 1)
    twice = smooth_elevations(data, 2)
    assert once[4, 4] < 100.0
    assert twice[4, 4] <= once[4, 4] + 1e-9
    assert once[4, 2] == 0
    assert twice[4, 2] > 0
    assert np.allclose(once.sum(), 100.0, atol=1e-9)
    assert np.allclose(twice.sum(), 100.0, atol=1e-9)


def test_smoothing_option_validation():
    options = GenerationOptions(bbox=BBox(47.0, 39.0, 47.01, 39.01), out_dir="out")
    options.terrain_smoothing = 2
    options.validate()
    options.terrain_smoothing = 3
    with pytest.raises(ValidationError):
        options.validate()
