; ============================================================
; GridVision SCADA - Inno Setup Script
; Compile with Inno Setup Compiler (https://jrsoftware.org/isinfo.php)
; ============================================================

#define MyAppName "GridVision SCADA"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "GridVision Technologies"
#define MyAppURL "https://github.com/chatgptnotes/GridVision"
#define MyAppExeName "start-gridvision.bat"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}/issues
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={autopf}\GridVision
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
LicenseFile=..\..\LICENSE
OutputDir=output
OutputBaseFilename=GridVision-SCADA-Setup-{#MyAppVersion}
SetupIconFile=assets\icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\assets\icon.ico

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "autostart"; Description: "Start GridVision automatically with Windows"; GroupDescription: "Startup:"

[Files]
; Copy the entire GridVision installation
Source: "{#MyAppName}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "http://localhost:5173"; Comment: "Open GridVision SCADA Dashboard"
Name: "{group}\Start GridVision Server"; Filename: "{app}\{#MyAppExeName}"; Comment: "Start the GridVision SCADA server"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "http://localhost:5173"; Tasks: desktopicon; Comment: "Open GridVision SCADA Dashboard"

[Registry]
; Auto-start entry
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "GridVisionSCADA"; ValueData: """{app}\{#MyAppExeName}"""; Tasks: autostart

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: shellexec postinstall skipifsilent

[UninstallRun]
Filename: "taskkill"; Parameters: "/f /im node.exe"; Flags: runhidden; RunOnceId: "KillNode"

[UninstallDelete]
Type: filesandordirs; Name: "{app}\node_modules"
Type: filesandordirs; Name: "{app}\.env"

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
  // Check for Node.js
  if not FileExists(ExpandConstant('{sys}\node.exe')) then
  begin
    if not FileExists(ExpandConstant('{pf}\nodejs\node.exe')) then
    begin
      if MsgBox('Node.js is required but not found. Would you like to download it?', mbConfirmation, MB_YESNO) = IDYES then
      begin
        ShellExec('open', 'https://nodejs.org/en/download/', '', '', SW_SHOW, ewNoWait, Result);
        MsgBox('Please install Node.js v18 or later, then re-run this installer.', mbInformation, MB_OK);
        Result := False;
      end else
        Result := False;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    // Run pnpm install after file copy
    Exec('cmd.exe', '/c cd /d "' + ExpandConstant('{app}') + '" && npm install -g pnpm && pnpm install',
         ExpandConstant('{app}'), SW_SHOW, ewWaitUntilTerminated, ResultCode);
  end;
end;
