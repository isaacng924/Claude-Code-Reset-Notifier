import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('Claude Reset Notifier is now active.');

	const disposable = vscode.commands.registerCommand('claude-reset-notifier.helloWorld', () => {
		vscode.window.showInformationMessage('Claude Reset Notifier is running!');
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
