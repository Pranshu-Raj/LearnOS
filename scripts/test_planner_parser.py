import unittest
import tempfile
import shutil
from pathlib import Path
from scripts.planner_parser import ParsedPlanner, PlannerTask, save_planner_to_vault

class TestPlannerParser(unittest.TestCase):

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def test_save_planner_to_vault(self):
        planner_data = ParsedPlanner(
            date="2026-07-28",
            goal="Complete Authentication Module",
            tasks=[
                PlannerTask(
                    task="Build Auth API",
                    slug="build-auth-api",
                    estimated_minutes=60,
                    subtasks=["JWT validation", "Password hashing"]
                ),
                PlannerTask(
                    task="Write Auth Tests",
                    slug="write-auth-tests",
                    estimated_minutes=30,
                    subtasks=["Unit test login", "Integration test refresh"]
                )
            ]
        )

        files = save_planner_to_vault(planner_data, self.test_dir)
        self.assertEqual(len(files), 2)

        # Verify topic file 1
        tf1 = Path(self.test_dir) / "Topics" / "build-auth-api.md"
        self.assertTrue(tf1.exists())
        content = tf1.read_text(encoding="utf-8")
        self.assertIn('topic: "Build Auth API"', content)
        self.assertIn('estimated_minutes: 60', content)
        self.assertIn('- [ ] JWT validation', content)

        # Verify Curriculum.md summary
        curr = Path(self.test_dir) / "Curriculum.md"
        self.assertTrue(curr.exists())
        curr_text = curr.read_text(encoding="utf-8")
        self.assertIn('Build Auth API', curr_text)

if __name__ == '__main__':
    unittest.main()
