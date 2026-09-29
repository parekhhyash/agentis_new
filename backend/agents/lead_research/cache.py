import time
from collections import OrderedDict
from collections.abc import Callable
from typing import Generic, TypeVar

V = TypeVar("V")


class TTLCache(Generic[V]):
    """Small in-process LRU+TTL cache. Shared across runs for search results
    and scraped pages, so repeat companies/queries within the TTL cost
    nothing - no external store needed at this scale."""

    def __init__(self, max_entries: int = 2000, ttl_seconds: float = 6 * 3600, clock: Callable[[], float] = time.monotonic):
        self._data: OrderedDict[str, tuple[float, V]] = OrderedDict()
        self._max_entries = max_entries
        self._ttl = ttl_seconds
        self._clock = clock

    def get(self, key: str) -> V | None:
        entry = self._data.get(key)
        if entry is None:
            return None
        stored_at, value = entry
        if self._clock() - stored_at > self._ttl:
            del self._data[key]
            return None
        self._data.move_to_end(key)
        return value

    def set(self, key: str, value: V) -> None:
        self._data[key] = (self._clock(), value)
        self._data.move_to_end(key)
        while len(self._data) > self._max_entries:
            self._data.popitem(last=False)

    def clear(self) -> None:
        self._data.clear()
