using CommunityToolkit.Mvvm.ComponentModel;

namespace ExamApp.ViewModels
{
    public partial class MainViewModel : ObservableObject
    {
        public QuestionBankViewModel QuestionBankVM { get; } = new();
        public ExamFormationViewModel ExamFormationVM { get; } = new();
        public ParticipantsViewModel ParticipantsVM { get; } = new();
        public PrintViewModel PrintVM { get; } = new();
        public ResultsViewModel ResultsVM { get; } = new();
    }
}
