import glob
import json
import logging
import math
import os
from collections import defaultdict

import networkx as nx
import numpy as np
from sklearn.neighbors import BallTree
from tqdm import tqdm  # Add tqdm for progress visualization
from utils import fetch_all_dem_data_from_bbox, get_nearest_elevation

# --- Constants ---

ORIGINAL_PATHS_DIR = os.path.join(os.path.dirname(__file__), "../datas/paths")
OUTPUT_PATHS_DIR = os.path.join(os.path.dirname(__file__), "../datas/paths_merged")

# Horizontal distance threshold in meters
EPSILON_H_METERS = 25
# Vertical distance threshold in meters
EPSILON_V_METERS = 15
# Earth radius in meters
EARTH_RADIUS_METERS = 6371000

# --- Logging Setup ---

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()],
)
log = logging.getLogger(__name__)


# --- Helper Functions ---
def haversine(lat1, lon1, lat2, lon2):
    """
    Calculate the great-circle distance between two points
    on the Earth (specified in decimal degrees) in meters.
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = EARTH_RADIUS_METERS * c
    return distance


def get_elevation(lat, lon, dem_data):
    """
    Get elevation for a given lat/lon.
    """
    return get_nearest_elevation(lat, lon, dem_data)


class UnionFind:
    """
    A simple Union-Find (Disjoint Set Union) data structure.
    Used for clustering endpoints.
    """

    def __init__(self, items):
        self.parent = {item: item for item in items}
        self.rank = {item: 0 for item in items}

    def find(self, i):
        """Find the root of the set containing item i."""
        if self.parent[i] == i:
            return i
        self.parent[i] = self.find(self.parent[i])  # Path compression
        return self.parent[i]

    def union(self, i, j):
        """Merge the sets containing items i and j."""
        root_i = self.find(i)
        root_j = self.find(j)
        if root_i != root_j:
            # Union by rank
            if self.rank[root_i] < self.rank[root_j]:
                self.parent[root_i] = root_j
            elif self.rank[root_i] > self.rank[root_j]:
                self.parent[root_j] = root_i
            else:
                self.parent[root_j] = root_i
                self.rank[root_i] += 1
            return True
        return False

    def get_clusters(self):
        """Return all clusters as a dict {root: [members]}."""
        clusters = defaultdict(list)
        for item in self.parent:
            root = self.find(item)
            clusters[root].append(item)
        return clusters


# --- Main Strategy Implementation ---


def phase_1_extract_endpoints(paths_dir):
    """
    Phase 1: Load all JSONs, extract all 'way' objects,
    and get their start/end endpoints.
    """
    log.info("🚀 Phase 1: Extracting endpoints...")
    all_ways = {}  # Store full way data by id
    all_endpoints = []  # List of endpoint dicts
    json_files = glob.glob(os.path.join(paths_dir, "*.json"))

    if not json_files:
        log.warning(f"🤔 No JSON files found in directory: {paths_dir}")
        return {}, []

    for f_path in tqdm(json_files, desc="Processing JSON files", unit="file"):
        try:
            with open(f_path, "r") as f:
                data = json.load(f)

            for element in tqdm(
                data.get("elements", []), desc="Processing elements", unit="element"
            ):
                if element.get("type") == "way" and "geometry" in element:
                    way_id = element["id"]
                    if way_id in all_ways:
                        continue  # Skip duplicate ways

                    geometry = element["geometry"]
                    if not geometry or len(geometry) < 2:
                        log.warning(f"Skipping way {way_id}: Invalid geometry")
                        continue

                    all_ways[way_id] = element

                    # Get start and end nodes
                    start_node = geometry[0]
                    end_node = geometry[-1]

                    # Get (mocked) elevation
                    min_lat = min(start_node["lat"], end_node["lat"])
                    max_lat = max(start_node["lat"], end_node["lat"])
                    min_lon = min(start_node["lon"], end_node["lon"])
                    max_lon = max(start_node["lon"], end_node["lon"])
                    dem_data = fetch_all_dem_data_from_bbox(
                        min_lon, min_lat, max_lon, max_lat
                    )
                    start_alt = get_elevation(
                        start_node["lat"], start_node["lon"], dem_data
                    )
                    end_alt = get_elevation(end_node["lat"], end_node["lon"], dem_data)

                    # Create unique IDs for endpoints
                    endpoint_id_start = f"{way_id}_start"
                    endpoint_id_end = f"{way_id}_end"

                    all_endpoints.append(
                        {
                            "id": endpoint_id_start,
                            "way_id": way_id,
                            "is_start": True,
                            "lat": start_node["lat"],
                            "lon": start_node["lon"],
                            "alt": start_alt,
                        }
                    )
                    all_endpoints.append(
                        {
                            "id": endpoint_id_end,
                            "way_id": way_id,
                            "is_start": False,
                            "lat": end_node["lat"],
                            "lon": end_node["lon"],
                            "alt": end_alt,
                        }
                    )

                # --- REMOVE THIS LINE TO PROCESS ALL FILES ---
                if len(all_endpoints) > 1024:
                    break
        except Exception as e:
            log.error(f"Failed to process file {f_path}: {e}")

        # --- REMOVE THIS LINE TO PROCESS ALL FILES ---
        if len(all_endpoints) > 1024:
            break

    log.info(
        f"✅ Phase 1: Extracted {len(all_endpoints)} endpoints from {len(all_ways)} ways."
    )
    return all_ways, all_endpoints


def phase_2_cluster_junctions(all_endpoints, epsilon_h, epsilon_v):
    """
    Phase 2: Cluster endpoints into junctions using BallTree and UnionFind.
    """
    log.info("🚀 Phase 2: Clustering junctions...")
    if not all_endpoints:
        log.warning("No endpoints to cluster.")
        return None, {}

    endpoint_ids = [ep["id"] for ep in all_endpoints]
    uf = UnionFind(endpoint_ids)

    # Prepare data for BallTree (must be in radians)
    endpoint_coords_rad = np.array(
        [[math.radians(ep["lat"]), math.radians(ep["lon"])] for ep in all_endpoints]
    )

    # Build spatial index
    tree = BallTree(endpoint_coords_rad, metric="haversine")

    # Convert horizontal threshold to radians
    radius_rad = epsilon_h / EARTH_RADIUS_METERS

    # Query the tree to find all pairs within the horizontal radius
    pairs_list = tree.query_radius(endpoint_coords_rad, r=radius_rad)

    merge_count = 0
    for i, neighbors in tqdm(
        enumerate(pairs_list),
        desc="Clustering endpoints",
        total=len(pairs_list),
        unit="endpoint",
    ):
        ep_i = all_endpoints[i]

        for j in neighbors:
            # Avoid self-loops and duplicate checks
            if i >= j:
                continue

            ep_j = all_endpoints[j]

            # Do not merge endpoints of the *same* way
            if ep_i["way_id"] == ep_j["way_id"]:
                continue

            # Check vertical distance
            if abs(ep_i["alt"] - ep_j["alt"]) < epsilon_v:
                # If both horizontal and vertical checks pass, union them
                if uf.union(ep_i["id"], ep_j["id"]):
                    merge_count += 1

    clusters = uf.get_clusters()
    log.info(
        f"✅ Phase 2: Clustered {len(endpoint_ids)} endpoints into {len(clusters)} junctions."
    )

    # Create a simple mapping from endpoint_id -> cluster_root_id
    endpoint_to_cluster_map = {ep_id: uf.find(ep_id) for ep_id in endpoint_ids}

    return uf, endpoint_to_cluster_map


def phase_3_build_graph(all_ways, endpoint_to_cluster_map):
    """
    Phase 3: Build a NetworkX MultiGraph from the ways and junctions.
    """
    log.info("🚀 Phase 3: Building trail graph...")
    # Use MultiGraph to allow parallel edges (e.g., two ways connecting
    # the same two junctions, like a summer and winter route)
    G = nx.MultiGraph()

    if not endpoint_to_cluster_map:
        log.warning("No clusters found, cannot build graph.")
        return G

    for way_id, way_data in tqdm(all_ways.items(), desc="Building graph", unit="way"):
        start_ep_id = f"{way_id}_start"
        end_ep_id = f"{way_id}_end"

        # Find which cluster (junction) this way's start/end belongs to
        cluster_start_id = endpoint_to_cluster_map.get(start_ep_id)
        cluster_end_id = endpoint_to_cluster_map.get(end_ep_id)

        if cluster_start_id is None or cluster_end_id is None:
            log.warning(f"Skipping way {way_id}: Endpoint not found in cluster map.")
            continue

        # Add an edge between the two junctions.
        # The edge *is* the way, so we store its data.
        G.add_edge(
            cluster_start_id,
            cluster_end_id,
            way_id=way_id,
            geometry=way_data["geometry"],
        )

    log.info(
        f"✅ Phase 3: Graph built with {G.number_of_nodes()} nodes (junctions) and {G.number_of_edges()} edges (ways)."
    )
    return G


def phase_4_simplify_graph(G, endpoint_to_cluster_map):
    """
    Phase 4: Simplify the graph by merging edges at 2-degree nodes.
    """
    log.info("🚀 Phase 4: Simplifying graph (merging 2-degree nodes)...")

    # We need to loop until no more merges are possible
    while True:
        nodes_to_merge = [n for n, deg in G.degree() if deg == 2]

        if not nodes_to_merge:
            log.info("    ... No more 2-degree nodes found. Simplification complete.")
            break

        log.info(f"    ... Found {len(nodes_to_merge)} 2-degree nodes to process.")
        merged_in_pass = 0

        for node in tqdm(nodes_to_merge, desc="Simplifying graph", unit="node"):
            # Check if node still exists (it might have been merged)
            if node not in G or G.degree(node) != 2:
                continue

            # Get the two neighbors
            neighbors = list(G.neighbors(node))
            if len(neighbors) != 2:
                log.warning(
                    f"Skipping node {node}: Expected 2 neighbors, found {len(neighbors)}."
                )
                continue

            n1, n2 = neighbors

            # Don't merge a simple loop (n1 == n2)
            if n1 == n2:
                continue

            # Get the two edges (NetworkX returns a dict; we get the first edge)
            # This assumes there's no parallel edge on a 2-degree-node segment
            edge1_data = G.get_edge_data(n1, node)[0]
            edge2_data = G.get_edge_data(node, n2)[0]

            geom1 = edge1_data["geometry"]
            way1_id = edge1_data["way_id"]
            geom2 = edge2_data["geometry"]
            way2_id = edge2_data["way_id"]

            # --- Figure out geometry orientation ---
            # We need to stitch geom1 and geom2 together.
            # We use the original endpoint_to_cluster_map to know the
            # "direction" of the geometry relative to the graph nodes.

            way1_start_cluster = endpoint_to_cluster_map[f"{way1_id}_start"]

            # Find ordered_geom1 (runs from n1 -> node)
            if way1_start_cluster == n1:
                ordered_geom1 = geom1
            else:  # way1_end_cluster must be n1
                ordered_geom1 = geom1[::-1]  # Reverse it

            way2_start_cluster = endpoint_to_cluster_map[f"{way2_id}_start"]

            # Find ordered_geom2 (runs from node -> n2)
            if way2_start_cluster == node:
                ordered_geom2 = geom2
            else:  # way2_end_cluster must be node
                ordered_geom2 = geom2[::-1]  # Reverse it

            # Stitch them together, skipping the duplicate middle point
            new_geometry = ordered_geom1 + ordered_geom2[1:]

            # Create a new way_id to show it's merged
            # (In a real system, you might want a list of IDs)
            new_way_id = f"merged_{way1_id}_{way2_id}"

            # Remove the middle node and two old edges
            G.remove_node(node)
            # Add the new, merged edge
            G.add_edge(n1, n2, way_id=new_way_id, geometry=new_geometry)

            # --- Update endpoint_to_cluster_map ---
            # Map the new way's start and end to their respective clusters
            endpoint_to_cluster_map[f"{new_way_id}_start"] = n1
            endpoint_to_cluster_map[f"{new_way_id}_end"] = n2

            merged_in_pass += 1

        if merged_in_pass == 0:
            log.info(
                "    ... No merges were possible in this pass (e.g., all 2-degree nodes were loops)."
            )
            break

    log.info(
        f"✅ Phase 4: Simplification complete. Final graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges."
    )
    return G


def save_graph_to_json(G, output_dir, chunk_size):
    """
    Save the simplified graph to multiple JSON files in the specified format.
    Each file contains up to `chunk_size` elements.
    """
    log.info(f"💾 Saving graph to {output_dir}...")
    elements = []

    # Initialize a unique ID counter
    unique_id_counter = 1

    for u, v, data in tqdm(G.edges(data=True), desc="Processing edges", unit="edge"):
        # Extract geometry and calculate bounds
        geometry = data["geometry"]
        minlat = min(point["lat"] for point in geometry)
        maxlat = max(point["lat"] for point in geometry)
        minlon = min(point["lon"] for point in geometry)
        maxlon = max(point["lon"] for point in geometry)

        # Fetch DEM data for the bounding box
        dem_data = fetch_all_dem_data_from_bbox(minlon, minlat, maxlon, maxlat)

        # Add elevation to each geometry point
        for point in geometry:
            point["alt"] = get_elevation(point["lat"], point["lon"], dem_data)

        # Assign a unique integer ID to the path
        unique_id = unique_id_counter
        unique_id_counter += 1

        # Create the element structure
        element = {
            "id": unique_id,  # Use the unique integer ID
            "bounds": {
                "minlat": minlat,
                "minlon": minlon,
                "maxlat": maxlat,
                "maxlon": maxlon,
            },
            "geometry": geometry,
        }
        elements.append(element)

    # Split elements into chunks and save each chunk to a separate file
    os.makedirs(output_dir, exist_ok=True)
    for i in tqdm(
        range(0, len(elements), chunk_size), desc="Saving chunks", unit="chunk"
    ):
        chunk = elements[i : i + chunk_size]
        output_file = os.path.join(
            output_dir, f"merged_trail_network_{i // chunk_size + 1}.json"
        )
        with open(output_file, "w") as f:
            json.dump({"elements": chunk}, f, indent=2)
        log.info(f"✅ Saved chunk {i // chunk_size + 1} to {output_file}.")


# --- Main Execution ---

if __name__ == "__main__":
    # --- Run the 4-Phase Strategy ---

    # Phase 1
    all_ways, all_endpoints = phase_1_extract_endpoints(ORIGINAL_PATHS_DIR)

    if all_ways:
        # Phase 2
        uf, endpoint_to_cluster_map = phase_2_cluster_junctions(
            all_endpoints, EPSILON_H_METERS, EPSILON_V_METERS
        )

        # Phase 3
        G = phase_3_build_graph(all_ways, endpoint_to_cluster_map)

        # Phase 4
        G_simplified = phase_4_simplify_graph(G, endpoint_to_cluster_map)

        # --- Show Final Results ---
        log.info("\n--- 🌲 Final Merged Trail Network 🌲 ---")
        log.info(f"Total Junctions (Nodes): {G_simplified.number_of_nodes()}")
        log.info(f"Total Segments (Edges): {G_simplified.number_of_edges()}")

        # --- Save Final Results ---
        if not os.path.exists(OUTPUT_PATHS_DIR):
            os.makedirs(OUTPUT_PATHS_DIR)
        output_file = os.path.join(OUTPUT_PATHS_DIR, "merged_trail_network.json")
        save_graph_to_json(G_simplified, OUTPUT_PATHS_DIR, chunk_size=1024)
    else:
        log.error("No way data loaded. Exiting.")
