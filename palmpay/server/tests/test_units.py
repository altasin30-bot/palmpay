"""Focused unit tests for PalmPay's pure helpers and scanner adapters.

Run from server/: python -m unittest discover -s tests -v
All vectors and encrypted values in these tests are synthetic.
"""
import math
import os
import sys
import unittest
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import core
import scanner


class MoneyUnitTests(unittest.TestCase):
    def test_valid_amounts(self):
        for value, expected in [('0.01', 0.01), ('10', 10.0), ('700.10', 700.1), ('50000', 50000.0)]:
            with self.subTest(value=value):
                self.assertEqual(core.money(value), expected)

    def test_invalid_amounts(self):
        for value in [None, '', 'abc', 'NaN', 'Infinity', '-Infinity', 0, -1, '50000.01', '1.001', True]:
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    core.money(value)

    def test_poisha_conversion_for_valid_decimal_amounts(self):
        for amount, expected in [('0.01', 1), ('1.20', 120), ('700.10', 70010), ('50000', 5000000)]:
            with self.subTest(amount=amount):
                self.assertEqual(core.poisha(Decimal(amount)), expected)


class VectorUnitTests(unittest.TestCase):
    def test_generated_vector_shape_and_range(self):
        vector = core.gen_palm_vector()
        self.assertEqual(len(vector), core.PALM_VECTOR_DIM)
        self.assertTrue(all(-1 <= n <= 1 and math.isfinite(n) for n in vector))

    def test_average_vectors(self):
        vectors = [[x] * core.PALM_VECTOR_DIM for x in (0.1, 0.2, 0.3)]
        self.assertEqual(core.average_vectors(vectors), [0.2] * core.PALM_VECTOR_DIM)

    def test_cosine_identical_orthogonal_opposite_and_zero(self):
        for first, second, expected in [([1, 0], [1, 0], 1), ([1, 0], [0, 1], 0), ([1, 0], [-1, 0], -1), ([0, 0], [1, 0], 0)]:
            with self.subTest(first=first, second=second):
                self.assertAlmostEqual(core.cosine_similarity(first, second), expected)
                self.assertAlmostEqual(scanner.similarity(first, second), expected)

    def test_core_rejects_different_vector_lengths(self):
        self.assertEqual(core.cosine_similarity([1, 0], [1]), 0.0)

    def test_template_encryption_roundtrip(self):
        vector = [0.1, -0.2, 0.3]
        encrypted = core.encrypt_template(vector)
        self.assertNotIn('[0.1, -0.2, 0.3]', encrypted)
        self.assertEqual(core.decrypt_template(encrypted), vector)

    def test_invalid_template_ciphertext_fails(self):
        from cryptography.fernet import InvalidToken
        with self.assertRaises(InvalidToken):
            core.decrypt_template('not-a-valid-token')


class ScannerUnitTests(unittest.TestCase):
    def setUp(self):
        self.template = [0.5] * core.PALM_VECTOR_DIM
        self.scanner = scanner.SimulatedScanner()

    def test_demo_success_is_a_noisy_copy(self):
        vector, quality = self.scanner.capture('success', self.template)
        self.assertEqual(quality, 'ok')
        self.assertEqual(len(vector), len(self.template))
        self.assertTrue(all(abs(a - b) <= 0.050001 for a, b in zip(vector, self.template)))

    def test_demo_unrecognized_vector_shape(self):
        vector, quality = self.scanner.capture('unrecognized', self.template)
        self.assertEqual(quality, 'ok')
        self.assertEqual(len(vector), len(self.template))
        self.assertTrue(all(-1 <= n <= 1 for n in vector))

    def test_poor_lighting_has_no_sample(self):
        self.assertEqual(self.scanner.capture('poor_lighting', self.template), (None, 'poor_lighting'))

    def test_invalid_demo_mode_rejected(self):
        with self.assertRaises(ValueError):
            self.scanner.capture('invalid', self.template)

    def test_real_scanner_fails_closed(self):
        with self.assertRaises(scanner.ScannerUnavailable):
            scanner.get_scanner('real').capture('success', self.template)

    def test_unknown_scanner_rejected(self):
        with self.assertRaises(scanner.ScannerUnavailable):
            scanner.get_scanner('unknown')


if __name__ == '__main__':
    unittest.main()
