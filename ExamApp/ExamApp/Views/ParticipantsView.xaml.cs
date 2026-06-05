using ExamApp.Dialogs;
using ExamApp.Models;
using ExamApp.ViewModels;
using System.Windows;
using System.Windows.Controls;

namespace ExamApp.Views
{
    public partial class ParticipantsView : UserControl
    {
        private ParticipantsViewModel VM => (ParticipantsViewModel)DataContext;

        public ParticipantsView()
        {
            InitializeComponent();
        }

        private async void UserControl_Loaded(object sender, RoutedEventArgs e)
        {
            await VM.LoadDataAsync();
        }

        private void AddParticipant_Click(object sender, RoutedEventArgs e)
        {
            var dlg = new EditParticipantDialog { Owner = Window.GetWindow(this) };
            if (dlg.ShowDialog() == true)
                _ = VM.RefreshAsync();
        }

        private void EditParticipant_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is Participant p)
            {
                var dlg = new EditParticipantDialog(p) { Owner = Window.GetWindow(this) };
                if (dlg.ShowDialog() == true)
                    _ = VM.RefreshAsync();
            }
        }

        private void DeleteParticipant_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is Participant p)
            {
                var result = MessageBox.Show(
                    $"Удалить участника «{p.FullName}»?",
                    "Подтверждение", MessageBoxButton.YesNo, MessageBoxImage.Warning);
                if (result == MessageBoxResult.Yes)
                    _ = VM.DeleteParticipantAsync(p);
            }
        }
    }
}
