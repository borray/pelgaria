using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ExamApp.Data;
using ExamApp.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Win32;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace ExamApp.ViewModels
{
    public class QuestionAnswerRow : ObservableObject
    {
        public int QuestionId { get; set; }
        public string QuestionText { get; set; } = string.Empty;
        public QuestionType QuestionType { get; set; }
        public int MaxScore { get; set; }
        public int QuestionOrder { get; set; }
        public bool IsFreeForm => QuestionType == QuestionType.FreeForm;
        public bool IsChoiceQuestion => QuestionType != QuestionType.FreeForm;

        private string _selectedLetters = string.Empty;
        public string SelectedLetters
        {
            get => _selectedLetters;
            set => SetProperty(ref _selectedLetters, value);
        }

        private int _freeFormScore;
        public int FreeFormScore
        {
            get => _freeFormScore;
            set => SetProperty(ref _freeFormScore, value);
        }

        public ObservableCollection<AnswerOptionRow> Options { get; set; } = new();
    }

    public class AnswerOptionRow : ObservableObject
    {
        public int OptionId { get; set; }
        public string Letter { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
        public bool IsCorrect { get; set; }

        private bool _isSelected;
        public bool IsSelected
        {
            get => _isSelected;
            set => SetProperty(ref _isSelected, value);
        }
    }

    public class ResultSummaryRow
    {
        public string ParticipantName { get; set; } = string.Empty;
        public string GroupName { get; set; } = string.Empty;
        public int Score { get; set; }
        public int MaxScore { get; set; }
        public double Percent => MaxScore > 0 ? (double)Score / MaxScore * 100.0 : 0.0;
        public bool IsChecked { get; set; }
        public string CheckedStatus => IsChecked ? "Проверено" : "Не проверено";
        public int ResultId { get; set; }
    }

    public partial class ResultsViewModel : BaseViewModel
    {
        [ObservableProperty]
        private ObservableCollection<ExamSession> _sessions = new();

        [ObservableProperty]
        private ExamSession? _selectedSession;

        [ObservableProperty]
        private ObservableCollection<ParticipantResult> _sessionResults = new();

        [ObservableProperty]
        private ParticipantResult? _selectedResult;

        [ObservableProperty]
        private ObservableCollection<QuestionAnswerRow> _answerRows = new();

        [ObservableProperty]
        private ObservableCollection<ResultSummaryRow> _summaryRows = new();

        [ObservableProperty]
        private string? _scannedBlankPath;

        [ObservableProperty]
        private ObservableCollection<Exam> _exams = new();

        [ObservableProperty]
        private Exam? _newSessionExam;

        [ObservableProperty]
        private DateTime _newSessionDate = DateTime.Today;

        [ObservableProperty]
        private string _newSessionLocation = string.Empty;

        [ObservableProperty]
        private ObservableCollection<Participant> _allParticipants = new();

        [ObservableProperty]
        private ObservableCollection<SelectableParticipant> _sessionParticipants = new();

        partial void OnSelectedSessionChanged(ExamSession? value) => _ = LoadSessionDataAsync();
        partial void OnSelectedResultChanged(ParticipantResult? value) => _ = LoadAnswerRowsAsync();

        public ResultsViewModel()
        {
            Title = "Служебный раздел";
        }

        [RelayCommand]
        public async Task LoadDataAsync()
        {
            using var ctx = new AppDbContext();
            var sessions = await ctx.ExamSessions
                .Include(s => s.Exam)
                .OrderByDescending(s => s.Date)
                .ToListAsync();
            Sessions.Clear();
            foreach (var s in sessions) Sessions.Add(s);

            var exams = await ctx.Exams.OrderBy(e => e.Title).ToListAsync();
            Exams.Clear();
            foreach (var e in exams) Exams.Add(e);

            var parts = await ctx.Participants.OrderBy(p => p.GroupName).ThenBy(p => p.LastName).ToListAsync();
            AllParticipants.Clear();
            foreach (var p in parts) AllParticipants.Add(p);
        }

        private async Task LoadSessionDataAsync()
        {
            if (SelectedSession == null)
            {
                SessionResults.Clear();
                SummaryRows.Clear();
                return;
            }

            using var ctx = new AppDbContext();
            var results = await ctx.ParticipantResults
                .Where(r => r.SessionId == SelectedSession.Id)
                .Include(r => r.Participant)
                .OrderBy(r => r.Participant!.GroupName)
                .ThenBy(r => r.Participant!.LastName)
                .ToListAsync();

            SessionResults.Clear();
            foreach (var r in results) SessionResults.Add(r);
            await RefreshSummaryAsync();
        }

        private async Task RefreshSummaryAsync()
        {
            if (SelectedSession == null) return;
            using var ctx = new AppDbContext();

            var session = await ctx.ExamSessions
                .Include(s => s.Exam)
                .ThenInclude(e => e!.ExamQuestions)
                .ThenInclude(eq => eq.Question)
                .FirstOrDefaultAsync(s => s.Id == SelectedSession.Id);

            if (session == null) return;

            int totalMax = session.Exam?.ExamQuestions.Sum(eq => eq.Question?.MaxScore ?? 0) ?? 0;

            var results = await ctx.ParticipantResults
                .Where(r => r.SessionId == SelectedSession.Id)
                .Include(r => r.Participant)
                .ToListAsync();

            SummaryRows.Clear();
            foreach (var r in results)
            {
                SummaryRows.Add(new ResultSummaryRow
                {
                    ParticipantName = r.Participant?.FullName ?? "",
                    GroupName = r.Participant?.GroupName ?? "",
                    Score = r.TotalScore,
                    MaxScore = totalMax,
                    IsChecked = r.IsChecked,
                    ResultId = r.Id
                });
            }
        }

        private async Task LoadAnswerRowsAsync()
        {
            AnswerRows.Clear();
            if (SelectedResult == null || SelectedSession == null) return;

            using var ctx = new AppDbContext();

            var session = await ctx.ExamSessions
                .Include(s => s.Exam)
                .ThenInclude(e => e!.ExamQuestions.OrderBy(eq => eq.Order))
                .ThenInclude(eq => eq.Question)
                .ThenInclude(q => q!.AnswerOptions.OrderBy(ao => ao.Order))
                .FirstOrDefaultAsync(s => s.Id == SelectedSession.Id);

            if (session?.Exam == null) return;

            var existingAnswers = await ctx.ParticipantAnswers
                .Where(a => a.ParticipantResultId == SelectedResult.Id)
                .ToListAsync();

            ScannedBlankPath = SelectedResult.ScannedBlankPath;
            var letters = "АБВГДЕЖЗ";

            foreach (var eq in session.Exam.ExamQuestions.OrderBy(x => x.Order))
            {
                var q = eq.Question!;
                var existingAnswer = existingAnswers.FirstOrDefault(a => a.QuestionId == q.Id);

                var row = new QuestionAnswerRow
                {
                    QuestionId = q.Id,
                    QuestionText = q.Text,
                    QuestionType = q.Type,
                    MaxScore = q.MaxScore,
                    QuestionOrder = eq.Order,
                    FreeFormScore = existingAnswer?.Score ?? 0
                };

                int[] selectedIds = Array.Empty<int>();
                if (existingAnswer?.SelectedOptionIdsJson != null)
                {
                    try
                    {
                        selectedIds = JsonSerializer.Deserialize<int[]>(existingAnswer.SelectedOptionIdsJson)
                            ?? Array.Empty<int>();
                    }
                    catch { }
                }

                int idx = 0;
                foreach (var opt in q.AnswerOptions.OrderBy(o => o.Order))
                {
                    row.Options.Add(new AnswerOptionRow
                    {
                        OptionId = opt.Id,
                        Letter = idx < letters.Length ? letters[idx].ToString() : (idx + 1).ToString(),
                        Text = opt.Text,
                        IsCorrect = opt.IsCorrect,
                        IsSelected = selectedIds.Contains(opt.Id)
                    });
                    idx++;
                }

                AnswerRows.Add(row);
            }
        }

        [RelayCommand]
        public async Task SaveAnswersAsync()
        {
            if (SelectedResult == null) return;
            IsBusy = true;
            try
            {
                using var ctx = new AppDbContext();
                var result = await ctx.ParticipantResults
                    .Include(r => r.Answers)
                    .FirstOrDefaultAsync(r => r.Id == SelectedResult.Id);

                if (result == null) return;

                // Remove old answers
                ctx.RemoveRange(result.Answers);

                int totalScore = 0;

                foreach (var row in AnswerRows)
                {
                    var answer = new ParticipantAnswer
                    {
                        ParticipantResultId = result.Id,
                        QuestionId = row.QuestionId
                    };

                    if (row.QuestionType == QuestionType.FreeForm)
                    {
                        answer.Score = Math.Clamp(row.FreeFormScore, 0, row.MaxScore);
                    }
                    else
                    {
                        var selectedIds = row.Options.Where(o => o.IsSelected).Select(o => o.OptionId).ToArray();
                        answer.SelectedOptionIdsJson = JsonSerializer.Serialize(selectedIds);

                        // Auto-calculate score
                        var correctIds = row.Options.Where(o => o.IsCorrect).Select(o => o.OptionId).ToHashSet();
                        var selectedSet = new System.Collections.Generic.HashSet<int>(selectedIds);

                        if (row.QuestionType == QuestionType.SingleChoice)
                        {
                            answer.Score = selectedSet.Count == 1 && correctIds.Contains(selectedSet.First())
                                ? row.MaxScore : 0;
                        }
                        else // MultipleChoice
                        {
                            if (selectedSet.SetEquals(correctIds))
                                answer.Score = row.MaxScore;
                            else
                                answer.Score = 0;
                        }
                    }

                    totalScore += answer.Score;
                    ctx.ParticipantAnswers.Add(answer);
                }

                result.TotalScore = totalScore;
                if (!string.IsNullOrEmpty(ScannedBlankPath))
                    result.ScannedBlankPath = ScannedBlankPath;

                await ctx.SaveChangesAsync();

                // Refresh in-memory selected result
                SelectedResult.TotalScore = totalScore;
                SelectedResult.ScannedBlankPath = result.ScannedBlankPath;

                await RefreshSummaryAsync();
                StatusMessage = "Ответы сохранены.";
            }
            catch (Exception ex)
            {
                StatusMessage = $"Ошибка: {ex.Message}";
            }
            finally
            {
                IsBusy = false;
            }
        }

        [RelayCommand]
        public async Task MarkCheckedAsync()
        {
            if (SelectedResult == null) return;
            using var ctx = new AppDbContext();
            var r = await ctx.ParticipantResults.FindAsync(SelectedResult.Id);
            if (r != null)
            {
                r.IsChecked = !r.IsChecked;
                await ctx.SaveChangesAsync();
                SelectedResult.IsChecked = r.IsChecked;
                await RefreshSummaryAsync();
                await LoadSessionDataAsync();
            }
        }

        [RelayCommand]
        public void BrowseScannedBlank()
        {
            var dlg = new OpenFileDialog
            {
                Title = "Выберите скан бланка",
                Filter = "Изображения и PDF|*.pdf;*.png;*.jpg;*.jpeg;*.bmp;*.tiff|Все файлы|*.*"
            };
            if (dlg.ShowDialog() == true)
                ScannedBlankPath = dlg.FileName;
        }

        [RelayCommand]
        public async Task CreateSessionAsync()
        {
            if (NewSessionExam == null)
            {
                StatusMessage = "Выберите экзамен для сессии.";
                return;
            }

            using var ctx = new AppDbContext();

            var session = new ExamSession
            {
                ExamId = NewSessionExam.Id,
                Date = NewSessionDate,
                Location = NewSessionLocation
            };
            ctx.ExamSessions.Add(session);
            await ctx.SaveChangesAsync();

            // Add selected participants
            var selected = SessionParticipants.Where(p => p.IsSelected).ToList();
            foreach (var sp in selected)
            {
                ctx.ParticipantResults.Add(new ParticipantResult
                {
                    SessionId = session.Id,
                    ParticipantId = sp.Participant.Id
                });
            }
            await ctx.SaveChangesAsync();

            NewSessionLocation = string.Empty;
            await LoadDataAsync();
            SelectedSession = Sessions.FirstOrDefault(s => s.Id == session.Id);
            StatusMessage = $"Сессия создана с {selected.Count} участниками.";
        }

        public void PrepareNewSessionParticipants()
        {
            SessionParticipants.Clear();
            foreach (var p in AllParticipants)
                SessionParticipants.Add(new SelectableParticipant { Participant = p, IsSelected = false });
        }

        [RelayCommand]
        public async Task AddParticipantToSessionAsync(Participant participant)
        {
            if (SelectedSession == null || participant == null) return;
            using var ctx = new AppDbContext();
            bool exists = await ctx.ParticipantResults
                .AnyAsync(r => r.SessionId == SelectedSession.Id && r.ParticipantId == participant.Id);
            if (exists) return;
            ctx.ParticipantResults.Add(new ParticipantResult
            {
                SessionId = SelectedSession.Id,
                ParticipantId = participant.Id
            });
            await ctx.SaveChangesAsync();
            await LoadSessionDataAsync();
        }

        [RelayCommand]
        public async Task RemoveResultAsync(ParticipantResult result)
        {
            if (result == null) return;
            using var ctx = new AppDbContext();
            var r = await ctx.ParticipantResults
                .Include(x => x.Answers)
                .FirstOrDefaultAsync(x => x.Id == result.Id);
            if (r != null)
            {
                ctx.RemoveRange(r.Answers);
                ctx.ParticipantResults.Remove(r);
                await ctx.SaveChangesAsync();
            }
            if (SelectedResult?.Id == result.Id)
                SelectedResult = null;
            await LoadSessionDataAsync();
        }

        [RelayCommand]
        public async Task DeleteSessionAsync(ExamSession session)
        {
            if (session == null) return;
            using var ctx = new AppDbContext();
            var s = await ctx.ExamSessions
                .Include(x => x.ParticipantResults)
                .ThenInclude(r => r.Answers)
                .FirstOrDefaultAsync(x => x.Id == session.Id);
            if (s != null)
            {
                foreach (var r in s.ParticipantResults)
                    ctx.RemoveRange(r.Answers);
                ctx.RemoveRange(s.ParticipantResults);
                ctx.ExamSessions.Remove(s);
                await ctx.SaveChangesAsync();
            }
            if (SelectedSession?.Id == session.Id)
            {
                SelectedSession = null;
                AnswerRows.Clear();
            }
            await LoadDataAsync();
        }

        public async Task RefreshAsync()
        {
            await LoadDataAsync();
        }
    }
}
