import time
from math import atan2, cos, radians, sin, sqrt

from geopy.exc import GeocoderTimedOut, GeocoderUnavailable
from geopy.geocoders import Nominatim

# ジオコーダーの初期化
# Nominatim使用時は必ずuser_agentを設定する
geolocator = Nominatim(user_agent="bear_sighting_app_v1", domain="nominatim.openstreetmap.org")

# ジオコーディング結果のキャッシュ
# 同じ場所を複数回検索することを避けるため
# より堅牢な実装にはRedisやデータベースの使用を検討
LOCATION_CACHE: dict[str, tuple[float, float] | None] = {}


def get_coordinates_for_location(prefecture: str | None, city: str | None) -> tuple[float, float] | None:
    """
    都道府県と市区町村から緯度経度を取得する
    都道府県のみ指定された場合は県庁所在地などの代表地点の座標を返す
    """
    # 都道府県が指定されていない場合は取得不可
    if not prefecture:
        return None

    # クエリ文字列の構築
    # 市区町村が指定されていない場合は都道府県名のみでジオコーディング
    if not city:
        query = f"{prefecture}, Japan"
    else:
        query = f"{city}, {prefecture}, Japan"

    # キャッシュの確認
    if query in LOCATION_CACHE:
        return LOCATION_CACHE[query]

    try:
        # Nominatim APIへのリクエスト（レート制限あり）
        print(f"🌐 Performing geocoding: {query}")
        location_data = geolocator.geocode(query, timeout=5.0)

        if location_data:
            # 取得成功時は結果をキャッシュに保存
            result = (location_data.latitude, location_data.longitude)
            LOCATION_CACHE[query] = result
            return result
        else:
            # 取得失敗時もキャッシュに保存（再検索を避けるため）
            LOCATION_CACHE[query] = None
            return None

    except (GeocoderTimedOut, GeocoderUnavailable) as e:
        # タイムアウトまたはサービス利用不可エラー時は待機
        print(f"⚠️ Geocoding error: {e}")
        time.sleep(5)
        return None
    except Exception as e:
        # その他の予期しないエラー
        print(f"❌ Unexpected geocoding error: {e}")
        return None


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0  # 地球の半径（km）

    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    distance = R * c
    return distance
