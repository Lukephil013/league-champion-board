using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;

internal static class ChampionBoardLauncher
{
    private const string MutexName = "Local\\LeagueChampionBoardTaskbarLauncher";

    [STAThread]
    private static void Main()
    {
        bool ownsMutex;
        using (var mutex = new Mutex(true, MutexName, out ownsMutex))
        {
            if (!ownsMutex)
            {
                OpenBoard();
                return;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new LauncherForm());
        }
    }

    internal static void OpenBoard()
    {
        string projectDirectory = AppDomain.CurrentDomain.BaseDirectory;
        string scriptPath = Path.Combine(projectDirectory, "launch.vbs");

        if (!File.Exists(scriptPath))
        {
            MessageBox.Show(
                "launch.vbs is missing from the Champion Board folder.",
                "Champion Board",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return;
        }

        Process.Start(new ProcessStartInfo
        {
            FileName = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "wscript.exe"),
            Arguments = "\"" + scriptPath + "\"",
            WorkingDirectory = projectDirectory,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden
        });
    }

    private sealed class LauncherForm : Form
    {
        private readonly NotifyIcon notifyIcon;
        private bool ready;

        internal LauncherForm()
        {
            Text = "Champion Board";
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            ClientSize = new Size(340, 110);
            MinimumSize = new Size(340, 110);
            ShowInTaskbar = true;
            StartPosition = FormStartPosition.Manual;
            Location = new Point(-32000, -32000);
            Opacity = 0;

            var openButton = new Button
            {
                Text = "Open Champion Board",
                AutoSize = true,
                Location = new Point(88, 38)
            };
            openButton.Click += delegate { OpenBoard(); WindowState = FormWindowState.Minimized; };
            Controls.Add(openButton);

            var menu = new ContextMenuStrip();
            menu.Items.Add("Open Champion Board", null, delegate { OpenBoard(); });
            menu.Items.Add("Exit taskbar launcher", null, delegate { Close(); });

            notifyIcon = new NotifyIcon
            {
                Icon = Icon,
                Text = "Champion Board",
                ContextMenuStrip = menu,
                Visible = true
            };
            notifyIcon.MouseClick += delegate(object sender, MouseEventArgs args)
            {
                if (args.Button == MouseButtons.Left) OpenBoard();
            };
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            BeginInvoke(new Action(delegate
            {
                WindowState = FormWindowState.Minimized;
                Opacity = 1;
                ready = true;
            }));
        }

        protected override bool ShowWithoutActivation { get { return true; } }

        protected override void OnActivated(EventArgs e)
        {
            base.OnActivated(e);
            if (!ready) return;

            OpenBoard();
            BeginInvoke(new Action(delegate { WindowState = FormWindowState.Minimized; }));
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            notifyIcon.Visible = false;
            notifyIcon.Dispose();
            base.OnFormClosed(e);
        }
    }
}
