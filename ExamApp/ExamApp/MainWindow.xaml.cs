using ExamApp.ViewModels;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace ExamApp
{
    public partial class MainWindow : Window
    {
        private readonly MainViewModel _vm = new();
        private Button? _activeNavButton;

        public MainWindow()
        {
            InitializeComponent();

            // Wire up ViewModels to Views
            QuestionBankView.DataContext = _vm.QuestionBankVM;
            ExamFormationView.DataContext = _vm.ExamFormationVM;
            ParticipantsView.DataContext = _vm.ParticipantsVM;
            PrintView.DataContext = _vm.PrintVM;
            ResultsView.DataContext = _vm.ResultsVM;

            // Activate initial section
            SetActiveNav(NavQuestionBank);
        }

        private void NavButton_Click(object sender, RoutedEventArgs e)
        {
            if (sender is not Button btn) return;

            var tag = btn.Tag?.ToString();
            SetActiveNav(btn);

            // Show/hide views
            QuestionBankView.Visibility = tag == "QuestionBank" ? Visibility.Visible : Visibility.Collapsed;
            ExamFormationView.Visibility = tag == "ExamFormation" ? Visibility.Visible : Visibility.Collapsed;
            ParticipantsView.Visibility = tag == "Participants" ? Visibility.Visible : Visibility.Collapsed;
            PrintView.Visibility = tag == "Print" ? Visibility.Visible : Visibility.Collapsed;
            ResultsView.Visibility = tag == "Results" ? Visibility.Visible : Visibility.Collapsed;
        }

        private void SetActiveNav(Button button)
        {
            // Reset previous
            if (_activeNavButton != null)
                _activeNavButton.Background = Brushes.Transparent;

            // Highlight active
            button.Background = new SolidColorBrush(Color.FromRgb(0x15, 0x65, 0xC0));
            _activeNavButton = button;
        }
    }
}
