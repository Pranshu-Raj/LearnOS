import unittest
from datetime import date, timedelta
from scripts.revision_engine import calculate_next_review

class TestRevisionEngine(unittest.TestCase):

    def setUp(self):
        self.today = date(2026, 7, 28)

    def test_first_solid_review(self):
        res = calculate_next_review(current_count=0, rating='solid', base_date=self.today)
        self.assertEqual(res['review_count'], 1)
        self.assertEqual(res['interval_days'], 1)
        self.assertEqual(res['next_review_due'], '2026-07-29')

    def test_sequence_progression(self):
        # 1st review -> +1 day
        r1 = calculate_next_review(0, 'solid', self.today)
        self.assertEqual(r1['interval_days'], 1)

        # 2nd review -> +3 days
        r2 = calculate_next_review(1, 'solid', self.today)
        self.assertEqual(r2['interval_days'], 3)

        # 3rd review -> +7 days
        r3 = calculate_next_review(2, 'solid', self.today)
        self.assertEqual(r3['interval_days'], 7)

        # 4th review -> +16 days
        r4 = calculate_next_review(3, 'solid', self.today)
        self.assertEqual(r4['interval_days'], 16)

        # 5th review -> +35 days
        r5 = calculate_next_review(4, 'solid', self.today)
        self.assertEqual(r5['interval_days'], 35)

    def test_shaky_review_resets_interval(self):
        res = calculate_next_review(current_count=3, rating='shaky', base_date=self.today)
        self.assertEqual(res['review_count'], 1)
        self.assertEqual(res['interval_days'], 1)
        self.assertEqual(res['next_review_due'], '2026-07-29')

if __name__ == '__main__':
    unittest.main()
