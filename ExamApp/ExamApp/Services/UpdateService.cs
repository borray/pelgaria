using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ExamApp.Services;

public record ReleaseAsset(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("browser_download_url")] string DownloadUrl,
    [property: JsonPropertyName("size")] long Size);

public record GitHubRelease(
    [property: JsonPropertyName("tag_name")] string TagName,
    [property: JsonPropertyName("name")] string ReleaseName,
    [property: JsonPropertyName("published_at")] DateTime PublishedAt,
    [property: JsonPropertyName("prerelease")] bool Prerelease,
    [property: JsonPropertyName("draft")] bool Draft,
    [property: JsonPropertyName("assets")] List<ReleaseAsset> Assets);

public record UpdateInfo(string TagName, DateTime PublishedAt, string DownloadUrl);

public class UpdateService
{
    private const string ApiUrl = "https://api.github.com/repos/borray/pelgaria/releases";
    private const string TagPrefix = "examapp-v";

    public bool IsDevBuild => BuildInfo.BuildDate == "0001-01-01T00:00:00Z";

    public async Task<UpdateInfo?> CheckForUpdateAsync()
    {
        if (IsDevBuild) return null;

        using var client = CreateClient();
        var json = await client.GetStringAsync(ApiUrl);
        var releases = JsonSerializer.Deserialize<List<GitHubRelease>>(json) ?? [];

        var latest = releases
            .Where(r => r.TagName.StartsWith(TagPrefix) && !r.Draft && !r.Prerelease)
            .OrderByDescending(r => r.PublishedAt)
            .FirstOrDefault();

        if (latest is null) return null;

        var localDate = DateTime.Parse(BuildInfo.BuildDate, null, DateTimeStyles.RoundtripKind);
        if (latest.PublishedAt <= localDate) return null;

        var asset = latest.Assets.FirstOrDefault(a => a.Name == "ExamApp.exe");
        if (asset is null) return null;

        return new UpdateInfo(latest.TagName, latest.PublishedAt, asset.DownloadUrl);
    }

    public async Task DownloadAndInstallAsync(UpdateInfo update, IProgress<int>? progress = null)
    {
        var currentExe = Process.GetCurrentProcess().MainModule!.FileName;
        var tempExe = currentExe + ".new";

        using var client = CreateClient();
        client.Timeout = TimeSpan.FromMinutes(10);

        var response = await client.GetAsync(update.DownloadUrl, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();

        var totalBytes = response.Content.Headers.ContentLength ?? 0;
        await using var stream = await response.Content.ReadAsStreamAsync();
        await using var file = File.Create(tempExe);

        var buffer = new byte[65536];
        long downloaded = 0;
        int bytesRead;

        while ((bytesRead = await stream.ReadAsync(buffer)) > 0)
        {
            await file.WriteAsync(buffer.AsMemory(0, bytesRead));
            downloaded += bytesRead;
            if (totalBytes > 0)
                progress?.Report((int)(downloaded * 100 / totalBytes));
        }

        file.Close();

        var updaterPath = Path.Combine(Path.GetTempPath(), "examapp_updater.bat");
        var script = $"""
            @echo off
            timeout /t 2 /nobreak >nul
            copy /y "{tempExe}" "{currentExe}"
            if errorlevel 1 (
                echo Не удалось обновить файл. Попробуйте запустить от имени администратора.
                pause
                goto :end
            )
            del "{tempExe}"
            start "" "{currentExe}"
            :end
            del "%~f0"
            """;

        await File.WriteAllTextAsync(updaterPath, script, Encoding.GetEncoding(866));

        Process.Start(new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = $"/c \"{updaterPath}\"",
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden
        });

        System.Windows.Application.Current.Shutdown();
    }

    private static HttpClient CreateClient()
    {
        var client = new HttpClient();
        client.DefaultRequestHeaders.Add("User-Agent", "ExamApp-Updater/1.0");
        client.Timeout = TimeSpan.FromSeconds(30);
        return client;
    }
}
