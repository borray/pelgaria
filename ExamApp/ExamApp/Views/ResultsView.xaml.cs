using ExamApp.Models;
using ExamApp.ViewModels;
using System.Windows;
using System.Windows.Controls;

namespace ExamApp.Views
{
    public partial class ResultsView : UserControl
    {
        private ResultsViewModel VM => (ResultsViewModel)DataContext;

        public ResultsView()
        {
            InitializeComponent();
        }

        private async void UserControl_Loaded(object sender, RoutedEventArgs e)
        {
            await VM.LoadDataAsync();
        }

        private void CreateSession_Click(object sender, RoutedEventArgs e)
        {
            VM.PrepareNewSessionParticipants();
            NewSessionPanel.Visibility = Visibility.Visible;
        }

        private void CancelNewSession_Click(object sender, RoutedEventArgs e)
        {
            NewSessionPanel.Visibility = Visibility.Collapsed;
        }

        private async void ConfirmNewSession_Click(object sender, RoutedEventArgs e)
        {
            await VM.CreateSessionAsync();
            NewSessionPanel.Visibility = Visibility.Collapsed;
        }

        private void DeleteSession_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is ExamSession session)
            {
                var result = MessageBox.Show(
                    $"Удалить сессию? Все результаты будут удалены.",
                    "Подтверждение", MessageBoxButton.YesNo, MessageBoxImage.Warning);
                if (result == MessageBoxResult.Yes)
                    _ = VM.DeleteSessionAsync(session);
            }
        }

        private void SelectResult_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is ParticipantResult r)
                VM.SelectedResult = r;
        }

        private void RemoveResult_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is ParticipantResult r)
            {
                var result = MessageBox.Show(
                    $"Удалить результат участника «{r.Participant?.FullName}»?",
                    "Подтверждение", MessageBoxButton.YesNo, MessageBoxImage.Warning);
                if (result == MessageBoxResult.Yes)
                    _ = VM.RemoveResultAsync(r);
            }
        }

        private async void SaveAnswers_Click(object sender, RoutedEventArgs e)
        {
            await VM.SaveAnswersAsync();
        }

        private async void MarkChecked_Click(object sender, RoutedEventArgs e)
        {
            await VM.MarkCheckedAsync();
        }

        private void BrowseBlank_Click(object sender, RoutedEventArgs e)
        {
            VM.BrowseScannedBlank();
        }
    }
}
