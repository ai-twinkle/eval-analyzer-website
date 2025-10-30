import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the example data
const examplePath = path.join(
  __dirname,
  '../public/examples/results_example.json',
);
const data = JSON.parse(fs.readFileSync(examplePath, 'utf-8'));

console.log('=== DATA STRUCTURE ANALYSIS ===\n');

// Analyze the structure
console.log('Timestamp:', data.timestamp);
console.log('Model:', data.config.model.name);
console.log('\nDatasets:', Object.keys(data.dataset_results));

// Analyze each dataset
for (const [datasetName, datasetData] of Object.entries(data.dataset_results)) {
  console.log(`\n--- ${datasetName} ---`);
  console.log(`Number of tests: ${datasetData.results.length}`);

  // Calculate dataset-level statistics
  const accuracies = datasetData.results.map((r) => r.accuracy_mean);
  const avgAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
  const minAccuracy = Math.min(...accuracies);
  const maxAccuracy = Math.max(...accuracies);

  console.log(`Average accuracy: ${(avgAccuracy * 100).toFixed(2)}%`);
  console.log(`Min accuracy: ${(minAccuracy * 100).toFixed(2)}%`);
  console.log(`Max accuracy: ${(maxAccuracy * 100).toFixed(2)}%`);

  // Show top 5 and bottom 5 tests
  const sorted = [...datasetData.results].sort(
    (a, b) => b.accuracy_mean - a.accuracy_mean,
  );

  console.log('\nTop 5 tests:');
  sorted.slice(0, 5).forEach((r, i) => {
    const filename = r.file.split('/').pop().replace('_test.csv', '');
    console.log(
      `  ${i + 1}. ${filename}: ${(r.accuracy_mean * 100).toFixed(2)}% (±${(r.accuracy_std * 100).toFixed(2)}%)`,
    );
  });

  console.log('\nBottom 5 tests:');
  sorted
    .slice(-5)
    .reverse()
    .forEach((r, i) => {
      const filename = r.file.split('/').pop().replace('_test.csv', '');
      console.log(
        `  ${i + 1}. ${filename}: ${(r.accuracy_mean * 100).toFixed(2)}% (±${(r.accuracy_std * 100).toFixed(2)}%)`,
      );
    });

  // Categorize by subject area (based on filename patterns)
  const categories = {};
  datasetData.results.forEach((r) => {
    const filename = r.file.split('/').pop().replace('_test.csv', '');

    // Extract category
    let category = 'Other';
    if (
      filename.includes('math') ||
      filename.includes('algebra') ||
      filename.includes('calculus') ||
      filename.includes('geometry') ||
      filename.includes('statistics')
    ) {
      category = 'Mathematics';
    } else if (
      filename.includes('physics') ||
      filename.includes('chemistry') ||
      filename.includes('biology') ||
      filename.includes('astronomy')
    ) {
      category = 'Science';
    } else if (
      filename.includes('computer') ||
      filename.includes('machine_learning') ||
      filename.includes('security')
    ) {
      category = 'Computer Science';
    } else if (
      filename.includes('law') ||
      filename.includes('legal') ||
      filename.includes('jurisprudence')
    ) {
      category = 'Law';
    } else if (
      filename.includes('history') ||
      filename.includes('geography') ||
      filename.includes('philosophy')
    ) {
      category = 'Humanities';
    } else if (
      filename.includes('business') ||
      filename.includes('economics') ||
      filename.includes('marketing') ||
      filename.includes('accounting') ||
      filename.includes('management')
    ) {
      category = 'Business & Economics';
    } else if (
      filename.includes('medicine') ||
      filename.includes('nutrition') ||
      filename.includes('anatomy') ||
      filename.includes('clinical') ||
      filename.includes('virology')
    ) {
      category = 'Medicine & Health';
    } else if (
      filename.includes('psychology') ||
      filename.includes('sociology')
    ) {
      category = 'Social Sciences';
    } else if (
      filename.includes('high_school') ||
      filename.includes('college') ||
      filename.includes('elementary')
    ) {
      const parts = filename
        .replace('high_school_', '')
        .replace('college_', '')
        .replace('elementary_', '');
      if (parts.includes('math')) category = 'Mathematics';
      else if (
        parts.includes('physics') ||
        parts.includes('chemistry') ||
        parts.includes('biology')
      )
        category = 'Science';
    }

    if (!categories[category]) categories[category] = [];
    categories[category].push(r);
  });

  console.log('\nBy Category:');
  Object.entries(categories)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([cat, tests]) => {
      const catAvg =
        tests.reduce((sum, t) => sum + t.accuracy_mean, 0) / tests.length;
      console.log(
        `  ${cat}: ${tests.length} tests, avg ${(catAvg * 100).toFixed(2)}%`,
      );
    });
}

console.log('\n=== VISUALIZATION RECOMMENDATIONS ===\n');
console.log('1. Overview Chart: Bar chart showing average accuracy by dataset');
console.log(
  '2. Category Breakdown: Grouped bar chart showing performance by subject category',
);
console.log(
  '3. Distribution: Box plot showing accuracy distribution with mean and std',
);
console.log(
  '4. Comparison: Radar chart comparing performance across categories',
);
console.log(
  '5. Top/Bottom: Horizontal bar chart of best and worst performing tests',
);
console.log(
  '6. Delta Analysis: When comparing models, show improvement/regression by category',
);
