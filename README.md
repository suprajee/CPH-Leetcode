# LeetCode Test Runner Extension for VS Code

This Visual Studio Code extension allows you to fetch, test, and debug LeetCode problem solutions directly within your editor. It supports Python and C++ solutions, automates test case fetching from LeetCode problem pages, and verifies your code against test cases.

## Features

- Fetch LeetCode problem test cases automatically.
- Supports Python and C++ solutions.
- Run test cases directly in the editor.
- View test results and debug outputs.

## Prerequisites

- Visual Studio Code
- Node.js (to run Puppeteer for fetching problem details)
- GCC (for compiling C++ code)
- Python (for running Python code)

## Installation

1. Clone this repository to your local machine:
   ```bash
   git clone https://github.com/suprajee/CPH-Leetcode/edit/main/README.md
   ```
2. Open the cloned folder in Visual Studio Code.
3. Install the required Node.js dependencies:
   ```bash
   npm install
   ```
4. Build and run the extension in VS Code by pressing `F5`.

## Usage

1. Open a LeetCode problem in your browser and copy the problem URL.
2. Open your solution file in VS Code (Python or C++).
3. Run the `Run Test` command from the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS) and select `Run LeetCode Test`.
4. Follow the prompts:
   - Select the language of your solution (Python or C++).
   - Enter the LeetCode problem URL.
5. View test results in the VS Code output.

## How It Works

1. **Fetching Test Cases:**
   - The extension uses Puppeteer to scrape input and output test cases from the LeetCode problem page.
2. **Preparing the Solution:**
   - For C++ solutions, a main function is auto-generated to call your solution with the test inputs.
   - For Python solutions, a test script is generated to invoke your solution.
3. **Running the Tests:**
   - Executes the solution file (compiled or interpreted) with the test inputs.
   - Compares the actual output with the expected output to determine test results.

## Configuration

- Test cases from LeetCode are fetched automatically.
- You can provide additional test cases in two optional files:
  - `user_inputs.txt`: For additional inputs.
  - `user_outputs.txt`: For corresponding expected outputs.
  
Place these files in the root of your workspace.

## Development

### Folder Structure

- **`src/`**: Source code of the extension.
- **`inputs.txt`** and **`outputs.txt`**: Test case storage (auto-generated).

### Scripts

- `npm install`: Install dependencies.
- `npm run build`: Build the extension.

### Key Functions

- **`fetchProblemDetails(url: string)`**: Fetches test cases from LeetCode.
- **`runTests(code: string, inputs: string[], outputs: string[], language: string)`**: Executes and validates tests.

## Troubleshooting

- **Error: No workspace folder is open.**
  - Open a folder in VS Code before running the tests.
- **Error: Unsupported language.**
  - Ensure your solution file is in Python or C++.
- **Browser Launch Issues:**
  - Puppeteer may require additional setup on some systems. Follow [Puppeteer troubleshooting guide](https://pptr.dev/troubleshooting) if you face issues.

## Contributing

Contributions are welcome! Please submit issues and pull requests on GitHub.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## Acknowledgments

- Inspired by competitive programming workflows and LeetCode problem-solving.
- Uses Puppeteer for web scraping.

---

Happy Coding!

