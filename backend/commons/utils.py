import time

from geopy.exc import GeocoderTimedOut, GeocoderUnavailable
from geopy.geocoders import Nominatim

# --- 1. Initialize the geocoder ---
# Always set a user_agent for Nominatim.
geolocator = Nominatim(
    user_agent="bear_sighting_app_v1", domain="nominatim.openstreetmap.org"
)

# --- 2. Cache ---
# Avoid querying the same location (e.g., "Morioka City") multiple times during execution.
# (For better robustness, consider using Redis or a database.)
LOCATION_CACHE: dict[str, tuple[float, float] | None] = {}


# --- 3. Geocoding function ---
def get_coordinates_for_location(
    prefecture: str | None, city: str | None
) -> tuple[float, float] | None:
    """
    Retrieve latitude and longitude from prefecture and city.
    """
    if not prefecture or not city:
        return None

    query = f"{city}, {prefecture}, Japan"

    # 1. Check the cache.
    if query in LOCATION_CACHE:
        return LOCATION_CACHE[query]

    try:
        # 2. Query the API (Nominatim has rate limits).
        print(f"🌐 Performing geocoding: {query}")
        location_data = geolocator.geocode(query, timeout=5.0)

        if location_data:
            result = (location_data.latitude, location_data.longitude)
            LOCATION_CACHE[query] = result  # 3. Save to cache.
            return result
        else:
            LOCATION_CACHE[query] = None  # 3. Cache None if not found.
            return None

    except (GeocoderTimedOut, GeocoderUnavailable) as e:
        print(f"⚠️ Geocoding error: {e}")
        time.sleep(5)  # Wait before retrying.
        return None
    except Exception as e:
        print(f"❌ Unexpected geocoding error: {e}")
        return None
