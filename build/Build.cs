using System;
using System.IO;
using Nuke.Common;
using Nuke.Common.IO;
using Nuke.Common.ProjectModel;
using Nuke.Common.Tooling;
using Nuke.Common.Tools.DotNet;
using static Nuke.Common.Tools.DotNet.DotNetTasks;

class Build : NukeBuild
{
    public static int Main() => Execute<Build>(x => x.Publish);

    [Parameter("Configuration to build - Default is 'Release'")]
    readonly string Configuration = "Release";

    AbsolutePath SourceDirectory => RootDirectory / "Aictionary";
    AbsolutePath ArtifactsDirectory => RootDirectory / "artifacts";
    
    // Windows
    AbsolutePath WindowsAmd64Directory => ArtifactsDirectory / "windows-amd64";
    AbsolutePath WindowsAmd64FrameworkDirectory => ArtifactsDirectory / "windows-amd64-framework-dependent";
    AbsolutePath WindowsArm64Directory => ArtifactsDirectory / "windows-arm64";
    AbsolutePath WindowsArm64FrameworkDirectory => ArtifactsDirectory / "windows-arm64-framework-dependent";
    
    // macOS
    AbsolutePath MacOSIntelDirectory => ArtifactsDirectory / "macos-intel";
    AbsolutePath MacOSIntelFrameworkDirectory => ArtifactsDirectory / "macos-intel-framework-dependent";
    AbsolutePath MacOSArm64Directory => ArtifactsDirectory / "macos-arm64";
    AbsolutePath MacOSArm64FrameworkDirectory => ArtifactsDirectory / "macos-arm64-framework-dependent";
    
    // Linux
    AbsolutePath LinuxAmd64Directory => ArtifactsDirectory / "linux-amd64";
    AbsolutePath LinuxAmd64FrameworkDirectory => ArtifactsDirectory / "linux-amd64-framework-dependent";
    AbsolutePath LinuxArm64Directory => ArtifactsDirectory / "linux-arm64";
    AbsolutePath LinuxArm64FrameworkDirectory => ArtifactsDirectory / "linux-arm64-framework-dependent";
    
    AbsolutePath ProjectFile => SourceDirectory / "Aictionary.csproj";

    Target Clean => _ => _
        .Before(Restore)
        .Executes(() =>
        {
            if (Directory.Exists(ArtifactsDirectory))
            {
                try
                {
                    Directory.Delete(ArtifactsDirectory, true);
                }
                catch (IOException)
                {
                    var backupDirectory = ArtifactsDirectory + $"_{DateTime.Now:yyyyMMddHHmmssfff}";
                    Directory.Move(ArtifactsDirectory, backupDirectory);
                    Serilog.Log.Warning("Could not delete artifacts directory, moved to {BackupDirectory}", backupDirectory);
                }
                catch (UnauthorizedAccessException)
                {
                    var backupDirectory = ArtifactsDirectory + $"_{DateTime.Now:yyyyMMddHHmmssfff}";
                    Directory.Move(ArtifactsDirectory, backupDirectory);
                    Serilog.Log.Warning("Could not delete artifacts directory due to access restrictions, moved to {BackupDirectory}", backupDirectory);
                }
            }

            Directory.CreateDirectory(ArtifactsDirectory);
        });

    Target Restore => _ => _
        .DependsOn(Clean)
        .Executes(() =>
        {
            DotNetRestore(s => s
                .SetProjectFile(ProjectFile));
        });

    Target Compile => _ => _
        .DependsOn(Restore)
        .Executes(() =>
        {
            DotNetBuild(s => s
                .SetProjectFile(ProjectFile)
                .SetConfiguration(Configuration)
                .EnableNoRestore());
        });

    Target PublishWindowsAmd64 => _ => _
        .Executes(() =>
        {
            DotNetPublish(s => s
                .SetProject(ProjectFile)
                .SetConfiguration(Configuration)
                .SetRuntime("win-x64")
                .SetSelfContained(true)
                .SetPublishSingleFile(true)
                .SetPublishTrimmed(false)
                .SetOutput(WindowsAmd64Directory));

            Serilog.Log.Information($"Windows AMD64 artifact published to: {WindowsAmd64Directory}");
        });

    Target PublishWindowsArm64 => _ => _
        .Executes(() =>
        {
            DotNetPublish(s => s
                .SetProject(ProjectFile)
                .SetConfiguration(Configuration)
                .SetRuntime("win-arm64")
                .SetSelfContained(true)
                .SetPublishSingleFile(true)
                .SetPublishTrimmed(false)
                .SetOutput(WindowsArm64Directory));

            Serilog.Log.Information($"Windows ARM64 artifact published to: {WindowsArm64Directory}");
        });

    Target PublishWindowsAmd64FrameworkDependent => _ => _
        .Executes(() =>
        {
            DotNetPublish(s => s
                .SetProject(ProjectFile)
                .SetConfiguration(Configuration)
                .SetRuntime("win-x64")
                .DisableSelfContained()
                .DisablePublishSingleFile()
                .SetPublishTrimmed(false)
                .SetOutput(WindowsAmd64FrameworkDirectory));

            Serilog.Log.Information($"Windows AMD64 framework-dependent artifact published to: {WindowsAmd64FrameworkDirectory}");
        });

    Target PublishWindowsArm64FrameworkDependent => _ => _
        .Executes(() =>
        {
            DotNetPublish(s => s
                .SetProject(ProjectFile)
                .SetConfiguration(Configuration)
                .SetRuntime("win-arm64")
                .DisableSelfContained()
                .DisablePublishSingleFile()
                .SetPublishTrimmed(false)
                .SetOutput(WindowsArm64FrameworkDirectory));

            Serilog.Log.Information($"Windows ARM64 framework-dependent artifact published to: {WindowsArm64FrameworkDirectory}");
        });

    Target PublishMacOSIntel => _ => _
        .Executes(() =>
        {
            CreateMacOSApp(MacOSIntelDirectory, "osx-x64", "macOS Intel");
        });

    Target PublishMacOSArm64 => _ => _
        .Executes(() =>
        {
            CreateMacOSApp(MacOSArm64Directory, "osx-arm64", "macOS ARM64");
        });

    Target PublishMacOSIntelFrameworkDependent => _ => _
        .Executes(() =>
        {
            CreateMacOSApp(MacOSIntelFrameworkDirectory, "osx-x64", "macOS Intel framework-dependent", false);
        });

    Target PublishMacOSArm64FrameworkDependent => _ => _
        .Executes(() =>
        {
            CreateMacOSApp(MacOSArm64FrameworkDirectory, "osx-arm64", "macOS ARM64 framework-dependent", false);
        });



    Target PublishLinuxAmd64 => _ => _
        .Executes(() =>
        {
            DotNetPublish(s => s
                .SetProject(ProjectFile)
                .SetConfiguration(Configuration)
                .SetRuntime("linux-x64")
                .SetSelfContained(true)
                .SetPublishSingleFile(true)
                .SetPublishTrimmed(false)
                .SetOutput(LinuxAmd64Directory));

            Serilog.Log.Information($"Linux AMD64 artifact published to: {LinuxAmd64Directory}");
        });

    Target PublishLinuxArm64 => _ => _
        .Executes(() =>
        {
            DotNetPublish(s => s
                .SetProject(ProjectFile)
                .SetConfiguration(Configuration)
                .SetRuntime("linux-arm64")
                .SetSelfContained(true)
                .SetPublishSingleFile(true)
                .SetPublishTrimmed(false)
                .SetOutput(LinuxArm64Directory));

            Serilog.Log.Information($"Linux ARM64 artifact published to: {LinuxArm64Directory}");
        });

    Target PublishLinuxAmd64FrameworkDependent => _ => _
        .Executes(() =>
        {
            DotNetPublish(s => s
                .SetProject(ProjectFile)
                .SetConfiguration(Configuration)
                .SetRuntime("linux-x64")
                .DisableSelfContained()
                .DisablePublishSingleFile()
                .SetPublishTrimmed(false)
                .SetOutput(LinuxAmd64FrameworkDirectory));

            Serilog.Log.Information($"Linux AMD64 framework-dependent artifact published to: {LinuxAmd64FrameworkDirectory}");
        });

    Target PublishLinuxArm64FrameworkDependent => _ => _
        .Executes(() =>
        {
            DotNetPublish(s => s
                .SetProject(ProjectFile)
                .SetConfiguration(Configuration)
                .SetRuntime("linux-arm64")
                .DisableSelfContained()
                .DisablePublishSingleFile()
                .SetPublishTrimmed(false)
                .SetOutput(LinuxArm64FrameworkDirectory));

            Serilog.Log.Information($"Linux ARM64 framework-dependent artifact published to: {LinuxArm64FrameworkDirectory}");
        });

    Target Publish => _ => _
        .DependsOn(Clean)
        .DependsOn(PublishWindowsAmd64, PublishWindowsArm64,
            PublishMacOSIntel, PublishMacOSArm64,
            PublishLinuxAmd64, PublishLinuxArm64,
            PublishWindowsAmd64FrameworkDependent, PublishWindowsArm64FrameworkDependent,
            PublishMacOSIntelFrameworkDependent, PublishMacOSArm64FrameworkDependent,
            PublishLinuxAmd64FrameworkDependent, PublishLinuxArm64FrameworkDependent,
            CreateMacOSDmg)
        .Executes(() =>
        {
            Serilog.Log.Information("All platforms published successfully!");
            Serilog.Log.Information($"Artifacts location: {ArtifactsDirectory}");
        });

    Target CreateMacOSDmg => _ => _
        .DependsOn(PublishMacOSArm64)
        .Executes(() =>
        {
            var dmgFile = MacOSArm64Directory / "Aictionary.dmg";
            if (File.Exists(dmgFile))
            {
                File.Delete(dmgFile);
            }

            var appBundlePath = MacOSArm64Directory / "Aictionary.app";

            var arguments = string.Join(" ", new[]
            {
                "--volname \"Aictionary\"",
                "--window-pos 200 120",
                "--window-size 800 400",
                "--icon-size 128",
                "--app-drop-link 600 185",
                $"\"{dmgFile}\"",
                $"\"{appBundlePath}\""
            });

            ProcessTasks.StartProcess("create-dmg", arguments)
                .AssertZeroExitCode();

            Serilog.Log.Information($"macOS DMG created at: {dmgFile}");
        });

    void CreateMacOSApp(AbsolutePath outputDirectory, string runtime, string logName, bool selfContained = true)
    {
        var publishOutput = outputDirectory / "publish";
        var appBundlePath = outputDirectory / "Aictionary.app";
        var contentsPath = appBundlePath / "Contents";
        var macOsPath = contentsPath / "MacOS";

        if (Directory.Exists(publishOutput))
            Directory.Delete(publishOutput, true);

        if (selfContained)
        {
            DotNetPublish(s => s
                .SetProject(ProjectFile)
                .SetConfiguration(Configuration)
                .SetRuntime(runtime)
                .SetSelfContained(true)
                .SetPublishSingleFile(true)
                .SetPublishTrimmed(false)
                .SetOutput(publishOutput));
        }
        else
        {
            DotNetPublish(s => s
                .SetProject(ProjectFile)
                .SetConfiguration(Configuration)
                .SetRuntime(runtime)
                .DisableSelfContained()
                .DisablePublishSingleFile()
                .SetPublishTrimmed(false)
                .SetOutput(publishOutput));
        }

        if (Directory.Exists(appBundlePath))
            Directory.Delete(appBundlePath, true);

        Directory.CreateDirectory(macOsPath);
        CopyDirectoryContents(publishOutput, macOsPath);
        Directory.Delete(publishOutput, true);

        // Copy Info.plist and icon
        var infoSource = SourceDirectory / "Info.plist";
        var iconSource = SourceDirectory / "Assets" / "AppIcon.icns";
        var resourcesDir = contentsPath / "Resources";
        var infoTarget = contentsPath / "Info.plist";

        Directory.CreateDirectory(resourcesDir);
        if (File.Exists(infoSource))
        {
            File.Copy(infoSource, infoTarget, true);
        }
        if (File.Exists(iconSource))
        {
            File.Copy(iconSource, resourcesDir / "AppIcon.icns", true);
        }

        Serilog.Log.Information($"{logName} artifact published to: {outputDirectory}");
    }

    static void CopyDirectoryContents(string source, string destination)
    {
        Directory.CreateDirectory(destination);

        foreach (var file in Directory.GetFiles(source))
        {
            var targetFile = Path.Combine(destination, Path.GetFileName(file));
            File.Copy(file, targetFile, true);
        }

        foreach (var directory in Directory.GetDirectories(source))
        {
            var targetDirectory = Path.Combine(destination, Path.GetFileName(directory));
            CopyDirectoryContents(directory, targetDirectory);
        }
    }
}
