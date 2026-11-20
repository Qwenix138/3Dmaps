class MapgenError(RuntimeError):
    pass


class DataSourceError(MapgenError):
    pass


class ValidationError(MapgenError):
    pass
