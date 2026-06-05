using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ExamApp.Data;
using ExamApp.Models;
using ExamApp.Services;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;

namespace ExamApp.ViewModels
{
    public class SelectableParticipant : ObservableObject
    {
        private bool _isSelected;
        public bool IsSelected
        {
            get => _isSelected;
            set => SetProperty(ref _isSelected, value);
        }
        public Participant Participant { get; set; } = null!;
    }

    public partial class PrintViewModel : BaseViewModel
    {
        [ObservableProperty]
        private ObservableCollection<Exam> _exams = new();

        [ObservableProperty]
        private Exam? _selectedExam;

        [ObservableProperty]
        private ObservableCollection<SelectableParticipant> _participants = new();

        [ObservableProperty]
        private DateTime _examDate = DateTime.Today;

        [ObservableProperty]
        private string? _lastGeneratedPath;

        [ObservableProperty]
        private bool _hasGenerated;

        [ObservableProperty]
        private bool _selectAll;

        partial void OnSelectAllChanged(bool value)
        {
            foreach (var p in Participants)
                p.IsSelected = value;
        }

        public PrintViewModel()
        {
            Title = "Печать бланков";
        }

        [RelayCommand]
        public async Task LoadDataAsync()
        {
            using var ctx = new AppDbContext();
            var exams = await ctx.Exams.OrderBy(e => e.Title).ToListAsync();
            Exams.Clear();
            foreach (var e in exams) Exams.Add(e);

            var participants = await ctx.Participants.OrderBy(p => p.GroupName).ThenBy(p => p.LastName).ToListAsync();
            Participants.Clear();
            foreach (var p in participants)
                Participants.Add(new SelectableParticipant { Participant = p, IsSelected = false });
        }

        [RelayCommand]
        public async Task GeneratePdfAsync()
        {
            if (SelectedExam == null)
            {
                StatusMessage = "Выберите экзамен.";
                return;
            }

            var selected = Participants.Where(p => p.IsSelected).Select(p => p.Participant).ToList();
            if (selected.Count == 0)
            {
                StatusMessage = "Выберите хотя бы одного участника.";
                return;
            }

            IsBusy = true;
            StatusMessage = "Генерация PDF...";
            try
            {
                using var ctx = new AppDbContext();
                var exam = await ctx.Exams
                    .Include(e => e.ExamQuestions)
                    .ThenInclude(eq => eq.Question)
                    .ThenInclude(q => q!.AnswerOptions)
                    .FirstOrDefaultAsync(e => e.Id == SelectedExam.Id);

                if (exam == null)
                {
                    StatusMessage = "Экзамен не найден.";
                    return;
                }

                var service = new PdfService();
                var path = await Task.Run(() =>
                    service.GenerateExamBlanks(exam, selected, ExamDate));

                LastGeneratedPath = path;
                HasGenerated = true;
                StatusMessage = $"PDF создан: {path}";
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
        public void OpenPdf()
        {
            if (string.IsNullOrEmpty(LastGeneratedPath)) return;
            try
            {
                Process.Start(new ProcessStartInfo(LastGeneratedPath) { UseShellExecute = true });
            }
            catch (Exception ex)
            {
                StatusMessage = $"Не удалось открыть файл: {ex.Message}";
            }
        }

        public async Task RefreshAsync()
        {
            await LoadDataAsync();
        }
    }
}
