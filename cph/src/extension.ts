import * as vscode from 'vscode';
import { exec } from 'child_process';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('leetcode-test.runTest', async () => {
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder is open. Please open a folder and try again.');
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor. Open a code file to run tests.');
            return;
        }

        const code = editor.document.getText();
        const language = await vscode.window.showQuickPick(['Python', 'C++'], {
            placeHolder: 'Select the language of your code',
        });

        if (!language) {
            vscode.window.showErrorMessage('No language selected.');
            return;
        }

        const problemUrl = await vscode.window.showInputBox({
            prompt: 'Enter the LeetCode Problem URL',
        });

        if (!problemUrl) {
            vscode.window.showErrorMessage('No URL provided.');
            return;
        }

        try {
            vscode.window.showInformationMessage('Fetching problem details...');
            const { inputs, outputs } = await fetch(problemUrl);

            const inputsFile = path.join(workspaceRoot, 'inputs.txt');
            const outputsFile = path.join(workspaceRoot, 'outputs.txt');

            fs.writeFileSync(inputsFile, inputs.join('\n'), 'utf8');
            fs.writeFileSync(outputsFile, outputs.join('\n'), 'utf8');

            vscode.window.showInformationMessage('Running your code...');
            const results = await runTests(code, inputs, outputs, language);

            vscode.window.showInformationMessage(results ? 'All tests passed!' : 'Some tests failed.');
        } catch (error) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Error: ${error.message}`);
            } else {
                vscode.window.showErrorMessage(`Error: ${String(error)}`);
            }
        }
    });

    context.subscriptions.push(disposable);
}

async function fetch(url: string): Promise<{ inputs: string[]; outputs: string[] }> {
    const browser = await puppeteer.launch({
        headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('pre');

    const testCases = await page.evaluate(() => {
        const inputs: string[] = [];
        const outputs: string[] = [];

        document.querySelectorAll('pre').forEach(pre => {
            const textContent = pre.textContent?.trim();
            if (!textContent) return;

            if (textContent.includes('Input:')) {
                const input = textContent.split('Input:')[1].split('Output:')[0].trim();
                inputs.push(input);
            }
            if (textContent.includes('Output:')) {
                const output = textContent.split('Output:')[1].split('Explanation')[0].trim();
                outputs.push(output);
            }
        });

        return { inputs, outputs };
    });

    await browser.close();
    return testCases;
}
function parseCPP(code: string, inputs: string[]): string {
    const functionRegex = /class\s+Solution\s*\{[^}]*\bpublic:\s+([\w<>\s&,*]+)\s+(\w+)\s*\(([^)]*)\)/s;
    const match = code.match(functionRegex);

    if (!match) {
        throw new Error('Could not parse the function signature from the provided code.');
    }

    const returnType = match[1].trim();
    const functionName = match[2].trim();
    const parameters = match[3].trim();

    const paramDetails = parameters
        .split(',')
        .map(param => {
            const [type, name] = param.trim().split(/\s+/);
            return { type, name };
        })
        .filter(Boolean);

    const listNodeClass = `
struct ListNode {
    int val;
    ListNode* next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode* next) : val(x), next(next) {}
};

// Helper function to create a linked list from a vector
ListNode* createLinkedList(const std::vector<int>& values) {
    if (values.empty()) return nullptr;
    ListNode* head = new ListNode(values[0]);
    ListNode* current = head;
    for (size_t i = 1; i < values.size(); ++i) {
        current->next = new ListNode(values[i]);
        current = current->next;
    }
    return head;
}

// Helper function to print a linked list as a vector
std::vector<int> printLinkedList(ListNode* head) {
    std::vector<int> result;
    while (head) {
        result.push_back(head->val);
        head = head->next;
    }
    return result;
}
`;

    const testCases = inputs.map((input, index) => {
        const args: Record<string, string> = {};
        const regex = /(\w+)\s*=\s*(\[[^\]]*\]|"[^"]*"|\S+)/g;

        function parseNestedArray(value: string): string {
            let depth = 0;
            let parsedValue = '';
            let i=0;
            while(i<value.length&&!(value[i]==='[')){
                i++;
            }
            for (; i < value.length; i++) {
                const char = value[i];
                if (char === '[') depth++;
                if (char === ']') depth--;
                parsedValue += char;
                if (depth === 0) break;
            }
            return parsedValue;
        }
        function createVectorOfListNodes(value: string): string {
            const parsedArray = JSON.parse(value); 
            const listNodeCreation = parsedArray.map(
                (subArray: number[]) =>
                    `createLinkedList(std::vector<int>{${subArray.join(',')}})`
            );
            return `std::vector<ListNode*>{${listNodeCreation.join(', ')}}`;
        }
    
        let match;
        while ((match = regex.exec(input)) !== null) {
            const key = match[1];
            let value = match[2];
            const isVectorOfListNode = paramDetails.some(
                ({ name, type }) => name === key && type.includes('vector<ListNode*>')
            );
            if (isVectorOfListNode) {
                value = parseNestedArray(input.slice(match.index + key.length + 1).trim());
                args[key] = createVectorOfListNodes(value);
            } else if (value.startsWith('[[')) {
                value = parseNestedArray(input.slice(match.index + key.length + 1).trim());
                // vscode.window.showInformationMessage(value);
                
                if (value.includes('"')) {
                    value = value
                        .replace(/\[/g, '{')
                        .replace(/\]/g, '}')
                        .replace(/"/g, "'");
                    args[key] = `std::vector<std::vector<char>>${value}`;
                } else {
                    value = value.replace(/\[/g, '{').replace(/\]/g, '}');
                    args[key] = `std::vector<std::vector<int>>${value}`;
                }
            } else if (value.startsWith('[') && value.includes('"')) {
                
                value = value.replace(/\[/g, '{').replace(/\]/g, '}');
                args[key] = `std::vector<std::string>${value}`;
            } else if (value.startsWith('[')) {
                const isLinkedList = paramDetails.some(
                    ({ name, type }) => name === key && type.includes('ListNode*')
                );
                if (isLinkedList) {
                    args[key] = `createLinkedList(${value.replace(/\[/g, '{').replace(/\]/g, '}')})`;
                } else {
                    value = value.replace(/\[/g, '{').replace(/\]/g, '}');
                    args[key] = `std::vector<int>${value}`;
                }
            } else if (value.startsWith('"') && value.endsWith('"')) {
                
                args[key] = value;
            } else {
                args[key] = value;
            }
        }

        const variables = paramDetails.map(({ type, name }) => {
            if (args[name] !== undefined) {
                return `auto ${name}_test${index + 1} = ${args[name]};`;
            } else {
                throw new Error(`Missing value for parameter: ${name}`);
            }
        });

        let outputLogic = '';
        if (returnType.includes('ListNode')) {
            outputLogic = `
            auto resultVector_test${index + 1} = printLinkedList(result_test${index + 1});
            cout << "[";
            for (size_t i = 0; i < resultVector_test${index + 1}.size(); ++i) {
                cout << resultVector_test${index + 1}[i];
                if (i < resultVector_test${index + 1}.size() - 1) cout << ",";
            }
            cout << "]";
            `;
        } else if (returnType === 'vector<int>') {
            outputLogic = `
            cout << "[";
            for (size_t i = 0; i < result_test${index + 1}.size(); ++i) {
                cout << result_test${index + 1}[i];
                if (i < result_test${index + 1}.size() - 1) cout << ",";
            }
            cout << "]";
            `;
        } else if (returnType === 'string') {
            outputLogic = `
            cout << "\\"";
            cout << result_test${index + 1};
            cout << "\\"";
            `;
        } else if (returnType === 'bool') {
            outputLogic = `
            cout << (result_test${index + 1} ? "true" : "false");
            `;
        } else if (returnType === "double") {
            outputLogic = `
            cout << fixed << setprecision(5);
            cout << result_test${index + 1};
            `;
        } else if (returnType === 'vector<string>') {
            outputLogic = `
            cout << "[";
            for (size_t i = 0; i < result_test${index + 1}.size(); ++i) {
                cout << "\\"";
                cout << result_test${index + 1}[i];
                cout << "\\"";
                if (i < result_test${index + 1}.size() - 1) cout << ",";
            }
            cout << "]";
            `;
        } else if (returnType === 'vector<vector<int>>') {
            outputLogic = `
            cout << "[";
            for (size_t i = 0; i < result_test${index + 1}.size(); ++i) {
                cout << "[";
                for (size_t j = 0; j < result_test${index + 1}[i].size(); ++j) {
                    cout << result_test${index + 1}[i][j];
                    if (j < result_test${index + 1}[i].size() - 1) cout << ",";
                }
                cout << "]";
                if (i < result_test${index + 1}.size() - 1) cout << ",";
            }
            cout << "]";
            `;
        } else if (returnType === 'vector<ListNode*>') {
            outputLogic = `
            cout << "[";
            for (size_t i = 0; i < result_test${index + 1}.size(); ++i) {
                ListNode* node = result_test${index + 1}[i];
                cout << "[";
                while (node) {
                    cout << node->val;
                    node = node->next;
                    if (node) cout << ",";
                }
                cout << "]";
                if (i < result_test${index + 1}.size() - 1) cout << ",";
            }
            cout << "]";
            `;
        } else if (returnType === 'vector<vector<char>>') {
            outputLogic = `
            cout << "[";
            for (size_t i = 0; i < result_test${index + 1}.size(); ++i) {
                cout << "[";
                for (size_t j = 0; j < result_test${index + 1}[i].size(); ++j) {
                    cout << "'" << result_test${index + 1}[i][j] << "'";
                    if (j < result_test${index + 1}[i].size() - 1) cout << ",";
                }
                cout << "]";
                if (i < result_test${index + 1}.size() - 1) cout << ",";
            }
            cout << "]";
            `;
        } else {
            outputLogic = `
            cout << result_test${index + 1};
            `;
        }

        return `
        // Test ${index + 1}
        ${variables.join('\n        ')}
        auto result_test${index + 1} = solution.${functionName}(${paramDetails
            .map(({ name }) => `${name}_test${index + 1}`)
            .join(', ')});
        ${outputLogic}
        cout << endl;`;
    });

    const mainFunction = `
#include <bits/stdc++.h>
using namespace std;

${listNodeClass}

${code}

int main() {
    Solution solution;
    ${testCases.join('\n')}
    return 0;
}`;
    return mainFunction;
}
function parsePython(code: string, inputs: string[]): string {
    const functionRegex = /class\s+Solution\s*\(.*?\):\s*def\s+(\w+)\s*\(([^)]*)\):/s;
    const match = code.match(functionRegex);

    if (!match) {
        throw new Error('Could not parse the function signature from the provided code.');
    }

    const functionName = match[1].trim();
    const parameters = match[2].trim();

    const paramDetails = parameters
        .split(',')
        .map(param => param.trim())
        .filter(param => param && param !== 'self'); // Ignore 'self'

    function parseNestedArray(value: string): string {
        let depth = 0;
        let parsedValue = '';
        let i=0;
        while(i<value.length&&!(value[i]==='[')){
            i++;
        }
        for (; i < value.length; i++) {
            const char = value[i];
            if (char === '[') depth++;
            if (char === ']') depth--;
            parsedValue += char;
            if (depth === 0) break; 
        }
        return parsedValue;
    }

    const testCases = inputs.map((input, index) => {
        const args: Record<string, string> = {};

        let regex = /(\w+)\s*=\s*(\[[^\]]*\]|"[^"]*"|\S+)/g;
        let match;

        while ((match = regex.exec(input)) !== null) {
            const key = match[1];
            let value = match[2];

            if (value.startsWith('[[')) {
                value = parseNestedArray(input.slice(match.index + key.length + 1).trim());
                args[key] = value;
            } else {
                args[key] = value;
            }
        }

        const argumentAssignments = paramDetails.map(param => {
            if (args[param] !== undefined) {
                return `${param} = ${args[param]}`;
            } else {
                throw new Error(`Missing value for parameter: ${param}`);
            }
        });

        return `
# Test ${index + 1}
${argumentAssignments.join('\n')}
result_test${index + 1} = solution.${functionName}(${paramDetails.join(', ')})
if isinstance(result_test${index + 1}, bool):
    print(str(result_test${index + 1}).lower())
else:
    print(result_test${index + 1})
`;
    });

    const mainFunction = `
# User code
${code}

if __name__ == "__main__":
    solution = Solution()
    ${testCases.join('\n')}
`;
    return mainFunction;
}


async function runTests(
    code: string,
    inputs: string[],
    outputs: string[],
    language: string
): Promise<boolean> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || __dirname;
    const codeDir = path.join(workspaceRoot, 'test-code');
    const userInputsFile = path.join(workspaceRoot, 'user_inputs.txt');
    const userOutputsFile = path.join(workspaceRoot, 'user_outputs.txt');

    // Ensure the code directory exists
    if (!fs.existsSync(codeDir)) {
        fs.mkdirSync(codeDir, { recursive: true });
    }

    if (!fs.existsSync(userInputsFile)) {
        fs.writeFileSync(userInputsFile, '', 'utf8');
    }

    if (!fs.existsSync(userOutputsFile)) {
        fs.writeFileSync(userOutputsFile, '', 'utf8');
    }
    
    const userInputs = fs.readFileSync(userInputsFile, 'utf8').split('\n').filter(line => line.trim());
    inputs.push(...userInputs);
    const userOutputs = fs.readFileSync(userOutputsFile, 'utf8').split('\n').filter(line => line.trim());
    outputs.push(...userOutputs);
    
    let codeFile: string; 
    console.log('Code directory:', codeDir);

    try {
        let commandTemplate: string;

        switch (language) {
            case 'C++': {
                codeFile = path.join(codeDir, 'code.cpp');
                const compiledFile = path.join(codeDir, 'code.out');
                const fullCode = parseCPP(code, inputs);

                fs.writeFileSync(codeFile, fullCode, 'utf8');

                await new Promise<void>((resolve, reject) => {
                    exec(`g++ "${codeFile}" -o "${compiledFile}"`, (error) => {
                        if (error) reject(error);
                        else resolve();
                    });
                });

                commandTemplate = `"${compiledFile}"`;
                break;
            }
            case 'Python': {
                codeFile = path.join(codeDir, 'code.py');
                const fullCode = parsePython(code, inputs);

                fs.writeFileSync(codeFile, fullCode, 'utf8');

                commandTemplate = `python "${codeFile}"`;
                break;
            }
            default:
                throw new Error('Unsupported language');
        }

        const fullOutput = await new Promise<string>((resolve, reject) => {
            exec(commandTemplate, (error, stdout) => {
                if (error) reject(error);
                else resolve(stdout.trim());
            });
        });

        const isOutputMatching = compareOutputs(fullOutput, outputs);

        if (isOutputMatching) {
            vscode.window.showInformationMessage('All tests passed!');
            return true;
        } else {
            vscode.window.showErrorMessage(`Test failed.\nExpected:\n${outputs.join('\n')}\nGot:\n${fullOutput}`);
            return false;
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Error during execution: ${error}`);
        return false;
    } 
}



function compareOutputs(actualOutput: string, expectedOutputs: string[]): boolean {
    const normalize = (output: string): any => {
        try {
            const sanitized = output
                .replace(/'/g, '"') 
                .replace(/(\w+)=/g, ''); 
            return JSON.parse(sanitized);
        } catch {
            return output.split('\n').map(line => line.trim());
        }
    };

    const normalizedActualOutput = actualOutput
        .split('\n')
        .map(line => normalize(line));

    const normalizedExpectedOutput = expectedOutputs.map(output => normalize(output));

    if (normalizedActualOutput.length !== normalizedExpectedOutput.length) return false;

    for (let i = 0; i < normalizedActualOutput.length; i++) {
        if (JSON.stringify(normalizedActualOutput[i]) !== JSON.stringify(normalizedExpectedOutput[i])) {
            return false;
        }
    }

    return true;
}




export function deactivate() {}
