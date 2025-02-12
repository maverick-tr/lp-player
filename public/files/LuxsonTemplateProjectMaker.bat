@echo off

REM Change directory to the current user's Documents/Projects folder
cd /d "%USERPROFILE%\Documents\Projects"

REM Greet the user and provide instructions
echo Welcome to ====== LUXSON Template Project Maker (.Net) ======
echo This script is intended to be run within Git Bash, leveraging both Windows batch commands and Unix-like utilities available in Git Bash.
echo Adjust paths and defaults as necessary for your specific environment or preferences.

:menu
echo.
echo Would you like to:
echo A. Create a new project
echo B. Clone an existing Git project
set /p choice="Choose (A/B): "

if /i "%choice%"=="A" goto create_project
if /i "%choice%"=="B" goto clone_project

goto menu

:create_project
REM Ask for the type of .NET project
echo.
echo What kind of .NET 6 project would you like to create?
echo a. Web App (Default)
echo b. Console Application
echo c. Web API
set /p project_type="Choose (a/b/c): "

if /i "%project_type%"=="a" set project_template=web
if /i "%project_type%"=="b" set project_template=console
if /i "%project_type%"=="c" set project_template=api

if not defined project_template (
    echo Invalid choice. Please select a, b, or c.
    goto create_project
)

REM Get the name for the new solution and project
set /p solution_name="Enter the desired name for your solution: "
if "%solution_name%"=="" set solution_name=www.pjh-test

set /p project_name="Enter the name for the project: "
if "%project_name%"=="" set project_name=pjh-test

REM Create the .NET 6 project
echo Creating a new %project_template% project...
mkdir "%solution_name%"
cd "%solution_name%"
dotnet new sln --name "%solution_name%"

REM Add framework version specification for the project
if /i "%project_type%"=="a" (
    dotnet new webapp -o "%project_name%" --framework net6.0
) else if /i "%project_type%"=="b" (
    dotnet new console -o "%project_name%" --framework net6.0
) else if /i "%project_type%"=="c" (
    dotnet new webapi -o "%project_name%" --framework net6.0
)

dotnet sln add "%project_name%\%project_name%.csproj"
cd ..

REM Ask to add Luxson Project Dll
set /p add_dll="Would you like to add the Luxson Project DLL? (Y/N): "
if /i "%add_dll%"=="y" (
    :set_dll_repo
    set /p dll_repo_url="Enter the path for ProjectDll or press Enter for default: "
    
    if "%dll_repo_url%"=="" (
        echo Using default path: "%USERPROFILE%\Luxson Dropbox\LUXSON\Git\DotNet\Templates\RawFiles\ProjectDll"
        if exist "%USERPROFILE%\Luxson Dropbox\LUXSON\Git\DotNet\Templates\RawFiles\ProjectDll" (
            echo Path verified successfully
        ) else (
            echo Warning: Default path not found at: "%USERPROFILE%\Luxson Dropbox\LUXSON\Git\DotNet\Templates\RawFiles\ProjectDll"
            echo Please check if the following directory structure exists:
            echo Luxson Dropbox\LUXSON\Git\DotNet\Templates\RawFiles\ProjectDll
            echo under your user profile: %USERPROFILE%
        )
        pause
    ) else if not exist "%dll_repo_url%" (
        echo Invalid path. Please try again.
        goto :set_dll_repo
    )

    echo Copying ProjectDll from "%USERPROFILE%\Luxson Dropbox\LUXSON\Git\DotNet\Templates\RawFiles\ProjectDll"...
    cd "%solution_name%"
    
    REM Check if the source directory exists
    if exist "%USERPROFILE%\Luxson Dropbox\LUXSON\Git\DotNet\Templates\RawFiles\ProjectDll" (
        REM Create ProjectDll directory if it doesn't exist
        if not exist "ProjectDll" mkdir "ProjectDll"
        
        REM Copy all files and subdirectories
        xcopy "%USERPROFILE%\Luxson Dropbox\LUXSON\Git\DotNet\Templates\RawFiles\ProjectDll\*" "ProjectDll\" /E /I /H /Y
        
        REM Check if copying was successful
        if errorlevel 1 (
            echo Failed to copy ProjectDll files. Skipping addition.
        ) else (
            echo Adding Project DLL to solution...
            dotnet sln "%solution_name%.sln" add "ProjectDll\ProjectDll.csproj"
        )
    ) else (
        echo The specified path does not exist or is invalid.
        pause
    )
)

REM Initialize Git
echo Initializing Git repository...
cd "%solution_name%"
git init

if errorlevel 1 (
    echo Failed to initialize Git repository.
    pause
    exit /b 1
)

REM Add .gitignore file
set /p gitignore_choice="Would you like to add a default .gitignore? (Y/N): "
if /i "%gitignore_choice%"=="y" (
    set "custom_gitignore=%USERPROFILE%\Luxson Dropbox\LUXSON\Git\DotNet\.gitignore"
    if not exist "%custom_gitignore%" (
        echo Default .gitignore file not found. Using standard Git ignore rules.
    ) else (
        echo Adding .gitignore...
        copy "%custom_gitignore%" .
        git add .gitignore
    )
)

REM Add all files to the initial commit
echo Adding all files for the initial commit...
git add .

if errorlevel 1 (
    echo Failed to stage files for commit.
    pause
    exit /b 1
)

REM Create Git bare repository
echo Creating Git bare repository...
cd ..
set /p repo_name="Enter the name for the Git bare repository or press Enter for default (%solution_name%): "
if "%repo_name%"=="" set repo_name=%solution_name%

mkdir "%USERPROFILE%\Luxson Dropbox\LUXSON\Git\DotNet\%repo_name%"
pushd "%USERPROFILE%\Luxson Dropbox\LUXSON\Git\DotNet"
git init --bare %repo_name%
popd

REM Add remote and push to the bare repository
echo Adding remote origin...
cd "%solution_name%"
git remote add origin "file://%USERPROFILE%/Luxson Dropbox/LUXSON/Git/DotNet/%repo_name%"
git commit -m "Project Setup"

if errorlevel 1 (
    echo Failed to commit changes.
    pause
    exit /b 1
)

git push -u origin master

if errorlevel 1 (
    echo Failed to push to Git repository.
    pause
    exit /b 1
)

REM Open project folder
echo All done. Press Enter to open your project folder.
pause >nul
start explorer "%USERPROFILE%\Documents\Projects\%solution_name%"
echo Please tweak/adjust any reference in ProjectDll as appropriate for this project.

goto end

:end