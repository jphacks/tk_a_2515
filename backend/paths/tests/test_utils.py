"""Tests for paths/utils.py"""

from paths.utils import (
    a_contains_b,
    a_contains_bottom_edge_of_b,
    a_contains_left_edge_of_b,
    a_contains_only_left_down_corner_of_b,
    a_contains_only_left_up_corner_of_b,
    a_contains_upper_edge_of_b,
    calc_necessary_bbox,
)


class TestBboxContainmentFunctions:
    """Test bbox containment helper functions"""

    def test_a_contains_b_true(self):
        """Test when bbox A completely contains bbox B"""
        # A: (0, 0, 10, 10), B: (2, 2, 8, 8)
        assert a_contains_b(0, 0, 10, 10, 2, 2, 8, 8) is True

    def test_a_contains_b_false(self):
        """Test when bbox A does not contain bbox B"""
        # A: (0, 0, 10, 10), B: (5, 5, 15, 15)
        assert a_contains_b(0, 0, 10, 10, 5, 5, 15, 15) is False

    def test_a_contains_b_equal(self):
        """Test when bbox A and B are identical"""
        # A: (0, 0, 10, 10), B: (0, 0, 10, 10)
        assert a_contains_b(0, 0, 10, 10, 0, 0, 10, 10) is True

    def test_a_contains_only_left_down_corner_of_b_true(self):
        """Test when A contains only the left-down corner of B"""
        # A: (0, 0, 5, 5), B: (3, 3, 10, 10)
        assert a_contains_only_left_down_corner_of_b(0, 0, 5, 5, 3, 3, 10, 10) is True

    def test_a_contains_only_left_down_corner_of_b_false(self):
        """Test when A does not contain only the left-down corner of B"""
        # A: (0, 0, 10, 10), B: (5, 5, 15, 15)
        assert a_contains_only_left_down_corner_of_b(0, 0, 10, 10, 5, 5, 15, 15) is True

    def test_a_contains_only_left_up_corner_of_b_true(self):
        """Test when A contains only the left-up corner of B"""
        # A: (5, 5, 15, 15), B: (0, 0, 10, 10)
        assert a_contains_only_left_up_corner_of_b(5, 5, 15, 15, 0, 0, 10, 10) is True

    def test_a_contains_left_edge_of_b_true(self):
        """Test when A contains the left edge of B"""
        # A: (0, 0, 5, 20), B: (3, 5, 10, 15)
        assert a_contains_left_edge_of_b(0, 0, 5, 20, 3, 5, 10, 15) is True

    def test_a_contains_bottom_edge_of_b_true(self):
        """Test when A contains the bottom edge of B"""
        # A: (0, 0, 20, 5), B: (5, 3, 15, 10)
        assert a_contains_bottom_edge_of_b(0, 0, 20, 5, 5, 3, 15, 10) is True

    def test_a_contains_upper_edge_of_b_true(self):
        """Test when A contains the upper edge of B"""
        # A: (0, 10, 20, 20), B: (5, 5, 15, 15)
        assert a_contains_upper_edge_of_b(0, 10, 20, 20, 5, 5, 15, 15) is True

    def test_a_contains_b_with_negative_coords(self):
        """Test a_contains_b with negative coordinates"""
        # A: (-10, -10, 10, 10), B: (-5, -5, 5, 5)
        assert a_contains_b(-10, -10, 10, 10, -5, -5, 5, 5) is True

    def test_a_contains_b_edge_case(self):
        """Test when B touches the edge of A"""
        # A: (0, 0, 10, 10), B: (0, 0, 10, 5)
        assert a_contains_b(0, 0, 10, 10, 0, 0, 10, 5) is True

    def test_a_contains_only_left_down_corner_edge_case(self):
        """Test left-down corner with exact boundaries"""
        test_case = (0, 0, 6, 6, 5, 5, 10, 10)
        assert a_contains_only_left_down_corner_of_b(*test_case) is True
        assert a_contains_b(*test_case) is False
        assert a_contains_only_left_up_corner_of_b(*test_case) is False
        assert a_contains_left_edge_of_b(*test_case) is False
        assert a_contains_bottom_edge_of_b(*test_case) is False
        assert a_contains_upper_edge_of_b(*test_case) is False

    def test_a_contains_left_edge_of_b_false(self):
        """Test when A does not contain left edge of B"""
        # A: (10, 10, 20, 20), B: (0, 5, 15, 15)
        assert a_contains_left_edge_of_b(10, 10, 20, 20, 0, 5, 15, 15) is False

    def test_a_contains_bottom_edge_of_b_false(self):
        """Test when A does not contain bottom edge of B"""
        # A: (10, 10, 20, 20), B: (5, 0, 15, 15)
        assert a_contains_bottom_edge_of_b(10, 10, 20, 20, 5, 0, 15, 15) is False

    def test_a_contains_only_left_up_corner_edge_case(self):
        """Test left-up corner exclusively"""
        test_case = (8, 8, 15, 15, 5, 5, 10, 10)
        assert a_contains_only_left_up_corner_of_b(*test_case) is True
        assert a_contains_b(*test_case) is False
        assert a_contains_only_left_down_corner_of_b(*test_case) is False
        assert a_contains_left_edge_of_b(*test_case) is False
        assert a_contains_bottom_edge_of_b(*test_case) is False
        assert a_contains_upper_edge_of_b(*test_case) is False

    def test_a_contains_left_edge_exclusively(self):
        """Test left edge exclusively"""
        test_case = (0, 0, 5, 20, 3, 5, 10, 15)
        assert a_contains_left_edge_of_b(*test_case) is True
        assert a_contains_b(*test_case) is False
        assert a_contains_only_left_down_corner_of_b(*test_case) is False
        assert a_contains_only_left_up_corner_of_b(*test_case) is False
        assert a_contains_bottom_edge_of_b(*test_case) is False
        assert a_contains_upper_edge_of_b(*test_case) is False

    def test_a_contains_bottom_edge_exclusively(self):
        """Test bottom edge exclusively"""
        test_case = (0, 0, 20, 5, 5, 3, 15, 10)
        assert a_contains_bottom_edge_of_b(*test_case) is True
        assert a_contains_b(*test_case) is False
        assert a_contains_only_left_down_corner_of_b(*test_case) is False
        assert a_contains_only_left_up_corner_of_b(*test_case) is False
        assert a_contains_left_edge_of_b(*test_case) is False
        assert a_contains_upper_edge_of_b(*test_case) is False

    def test_a_contains_upper_edge_exclusively(self):
        """Test upper edge exclusively"""
        test_case = (0, 10, 20, 20, 5, 5, 15, 15)
        assert a_contains_upper_edge_of_b(*test_case) is True
        assert a_contains_b(*test_case) is False
        assert a_contains_only_left_down_corner_of_b(*test_case) is False
        assert a_contains_only_left_up_corner_of_b(*test_case) is False
        assert a_contains_left_edge_of_b(*test_case) is False
        assert a_contains_bottom_edge_of_b(*test_case) is False

    def test_no_containment_at_all(self):
        """Test when bboxes are completely separate"""
        test_case = (0, 0, 5, 5, 10, 10, 15, 15)
        assert a_contains_b(*test_case) is False
        assert a_contains_only_left_down_corner_of_b(*test_case) is False
        assert a_contains_only_left_up_corner_of_b(*test_case) is False
        assert a_contains_left_edge_of_b(*test_case) is False
        assert a_contains_bottom_edge_of_b(*test_case) is False
        assert a_contains_upper_edge_of_b(*test_case) is False


class TestCalcNecessaryBbox:
    """Test calc_necessary_bbox function"""

    def test_new_bbox_contains_previous(self):
        """Test when new bbox completely contains previous bbox"""
        result = calc_necessary_bbox(0, 0, 10, 10, 2, 2, 8, 8)
        assert result == [(0, 0, 10, 10)]

    def test_previous_bbox_contains_new(self):
        """Test when previous bbox completely contains new bbox"""
        result = calc_necessary_bbox(2, 2, 8, 8, 0, 0, 10, 10)
        assert result == []

    def test_new_bbox_identical_to_previous(self):
        """Test when bboxes are identical"""
        result = calc_necessary_bbox(0, 0, 10, 10, 0, 0, 10, 10)
        print(result)
        assert result == []

    def test_new_contains_only_left_down_corner(self):
        """Test when new bbox contains only left-down corner of previous"""
        result = calc_necessary_bbox(0, 0, 5, 5, 3, 3, 10, 10)
        assert result == [(0, 0, 3, 5), (3, 0, 5, 3)]

    def test_previous_contains_only_left_down_corner(self):
        """Test when previous bbox contains only left-down corner of new"""
        result = calc_necessary_bbox(5, 5, 10, 10, 0, 0, 7, 7)
        assert result == [(7, 5, 10, 10), (5, 7, 7, 10)]

    def test_new_contains_only_left_up_corner(self):
        """Test when new bbox contains only left-up corner of previous"""
        result = calc_necessary_bbox(0, 0, 5, 10, 3, 5, 10, 15)
        print(result)
        assert result == [(0, 0, 3, 10), (3, 0, 5, 5)]

    def test_new_contains_left_edge(self):
        """Test when new bbox contains left edge of previous"""
        result = calc_necessary_bbox(0, 0, 5, 20, 3, 5, 10, 15)
        assert result == [(0, 0, 3, 20), (3, 0, 5, 15), (3, 15, 5, 20)]

    def test_no_overlap(self):
        """Test when bboxes don't overlap"""
        result = calc_necessary_bbox(0, 0, 5, 5, 10, 10, 15, 15)
        assert result == [(0, 0, 5, 5)]

    def test_previous_contains_left_edge_of_new(self):
        """Test when previous bbox contains left edge of new"""
        result = calc_necessary_bbox(5, 5, 10, 10, 0, 0, 7, 15)
        assert result == [(7, 5, 10, 10)]

    def test_new_contains_bottom_edge(self):
        """Test when new bbox contains bottom edge of previous"""
        result = calc_necessary_bbox(0, 0, 20, 5, 5, 3, 15, 10)
        assert result == [(0, 0, 20, 3), (0, 3, 5, 5), (15, 3, 20, 5)]

    def test_previous_contains_bottom_edge_of_new(self):
        """Test when previous bbox contains bottom edge of new"""
        result = calc_necessary_bbox(5, 5, 15, 10, 0, 0, 20, 7)
        assert result == [(5, 7, 15, 10)]

    def test_new_contains_upper_edge(self):
        """Test when new bbox contains upper edge of previous"""
        result = calc_necessary_bbox(0, 10, 20, 20, 5, 5, 15, 15)
        assert result == [(0, 15, 20, 20), (0, 10, 5, 15), (15, 10, 20, 15)]

    def test_previous_contains_upper_edge_of_new(self):
        """Test when previous bbox contains upper edge of new"""
        result = calc_necessary_bbox(5, 5, 15, 15, 0, 10, 20, 20)
        assert result == [(5, 5, 15, 10)]
