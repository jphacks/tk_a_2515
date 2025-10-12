import math
from pathlib import Path

import requests

DOMAIN_URL = "https://cyberjapandata.gsi.go.jp/xyz/dem/"
sample_z = 14
sample_x = 14547
sample_y = 6463

# 取得範囲
X_RANGE = (14088, 14828)
Y_RANGE = (5859, 6707)
FETCH_INTERVAL = 0.01  # 取得間隔（秒）


def fetch_dem_data(z, x, y):
    """
    指定されたz/x/y座標のDEMデータを取得

    Args:
        z: ズームレベル
        x: X座標
        y: Y座標

    Returns:
        list: カンマ区切りデータを2次元配列にパースしたもの
        None: エラー時
    """
    url = f"{DOMAIN_URL}{z}/{x}/{y}.txt"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        # カンマ区切りデータをパース
        lines = response.text.strip().split("\n")
        data = [line.split(",") for line in lines]
        data = [
            [float(value) if value != "e" else 0 for value in line] for line in data
        ]
        res = {}
        for i, row in enumerate(data):
            for j, value in enumerate(row):
                res[(i, j)] = value

        return res
    except requests.exceptions.RequestException as e:
        error_file = Path("error") / f"error_{z}_{x}_{y}.txt"
        error_file.parent.mkdir(exist_ok=True)
        with open(error_file, "w") as f:
            f.write(f"Error fetching {url}: {e}\n")
        return None


def calc_delta_x(z: int) -> float:
    """ズームレベルzにおける1ピクセルの経度差"""
    return 360 / (2**z * 256)


def calc_delta_y(z: int, lat: float) -> float:
    """ズームレベルzにおける1ピクセルの緯度差"""
    rad = math.radians(lat)
    return 360 * math.cos(rad) / (2**z * 256)


def x_from_lon(lon_deg: float, z: int) -> int:
    """
    x = ⌊(lon + 180) / 360 · 2^(z-1)⌋
    lon_deg: 経度（度）
    z      : ズーム（整数）
    return : 切り下げ後の x（整数）
    """
    val = (lon_deg + 180) / 360
    return math.floor(val * (2**z))


def y_from_lat(lat_deg: float, z: int) -> int:
    """
    y = ⌊(1 - ln(tan(lat·π/180) + 1/cos(lat·π/180)) / π) · 2^(z-1)⌋
    lat_deg: 緯度（度）
    z      : ズーム（整数）
    return : 切り下げ後の y（整数）
    """
    rad = math.radians(lat_deg)
    val = 1 - (math.log(math.tan(rad) + 1 / math.cos(rad)) / math.pi)
    return math.floor(val * (2 ** (z - 1)))


def lon_from_x(x: int, z: int) -> float:
    """
    lon = x / 2^(z-1) * 360 - 180
    x      : x座標（整数）
    z      : ズーム（整数）
    return : 経度（度）
    """
    return (x / (2**z)) * 360 - 180


def lat_from_y(y: int, z: int) -> float:
    """
    lat = arctan(sinh(π * (1 - 2 * y / 2^(z-1)))) * 180/π
    y      : y座標（整数）
    z      : ズーム（整数）
    return : 緯度（度）
    """
    n = math.pi * (1 - 2 * y / (2**z))
    return math.degrees(math.atan(math.sinh(n)))


def fetch_all_dem_data_from_bbox(min_lon, min_lat, max_lon, max_lat, z=sample_z):
    """
    指定された経度緯度の範囲のDEMデータを取得
    """
    x_min = int(x_from_lon(min_lon, z))
    y_min = int(y_from_lat(max_lat, z))
    x_max = math.ceil(x_from_lon(max_lon, z))
    y_max = math.ceil(y_from_lat(min_lat, z))

    dem_data = {}
    for x in range(x_min, x_max + 1):
        for y in range(y_min, y_max + 1):
            data = fetch_dem_data(z, x, y)
            if data:
                dem_data[(x, y)] = data

    return dem_data
