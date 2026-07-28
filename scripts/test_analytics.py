import unittest
import tempfile
import shutil
from pathlib import Path
from scripts.analytics import get_vault_analytics

class TestAnalytics(unittest.TestCase):

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.topics_dir = Path(self.test_dir) / "Topics"
        self.topics_dir.mkdir(parents=True)

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def test_analytics_calculation(self):
        # Create topic 1: completed, estimated 60, actual 90 (bottleneck 1.5x)
        t1 = self.topics_dir / "topic1.md"
        t1.write_text("""---
topic: "Topic 1"
status: done
estimated_minutes: 60
actual_minutes: 90
---
Content
""", encoding="utf-8")

        # Create topic 2: completed, estimated 100, actual 70 (under estimate)
        t2 = self.topics_dir / "topic2.md"
        t2.write_text("""---
topic: "Topic 2"
status: done
estimated_minutes: 100
actual_minutes: 70
---
Content
""", encoding="utf-8")

        # Create topic 3: incomplete, estimated 45
        t3 = self.topics_dir / "topic3.md"
        t3.write_text("""---
topic: "Topic 3"
status: not-started
estimated_minutes: 45
---
Content
""", encoding="utf-8")

        analytics = get_vault_analytics(self.test_dir)
        self.assertEqual(analytics['total_topics'], 3)
        self.assertEqual(analytics['completed_topics'], 2)
        self.assertEqual(analytics['total_estimated_minutes'], 160)
        self.assertEqual(analytics['total_actual_minutes'], 160)
        self.assertEqual(analytics['velocity_ratio'], 1.0)
        self.assertEqual(len(analytics['bottlenecks']), 1)
        self.assertEqual(analytics['bottlenecks'][0]['filename'], 'topic1.md')
        self.assertEqual(len(analytics['remaining_topics']), 1)

if __name__ == '__main__':
    unittest.main()
