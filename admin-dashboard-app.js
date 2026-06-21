function AdminDashboardApp() {
  try {
    const [enrollments, setEnrollments] = React.useState([]);
    const [filter, setFilter] = React.useState('Todos');
    const [searchTerm, setSearchTerm] = React.useState('');
    const [alert, setAlert] = React.useState(null);
    const [selected, setSelected] = React.useState(null);
    const [rejectionReason, setRejectionReason] = React.useState('');
    const [customReason, setCustomReason] = React.useState('');
    const [observations, setObservations] = React.useState('');
    const [sending, setSending] = React.useState(false);
    const [viewingDocument, setViewingDocument] = React.useState(null);

    React.useEffect(() => {
      const session = JSON.parse(localStorage.getItem('userSession') || '{}');
      if (!session.userId || session.userType !== 'admin') {
        window.location.href = 'login.html';
      }
      loadEnrollments();
    }, []);

    const loadEnrollments = async () => {
      try {
        const result = await trickleListObjects('matricula', 100, true);
        if (result && result.items) {
          setEnrollments(result.items);
        } else {
          setEnrollments([]);
        }
      } catch (error) {
        console.error('Load enrollments error:', error);
        setEnrollments([]);
        setAlert({ message: 'Erro ao carregar dados. A lista de matrículas está vazia.', type: 'warning' });
      }
    };

    const sendNotifications = async (email, phone, studentName) => {
      const emailSubject = 'Requisição Aprovada - Bondo Matuatunguila';
      const emailBody = `Olá ${studentName},\n\nA sua requisição foi analisada e aprovada com sucesso!\n\nPor favor, aguarde as próximas orientações do Instituto Bondo Matuatunguila. Entraremos em contacto em breve.\n\nBondo Matuatunguila\nFamília vamos construir`;
      
      const whatsappMessage = `Olá ${studentName},\n\nA sua requisição foi analisada e aprovada com sucesso!\n\nPor favor, aguarde as próximas orientações do Instituto Bondo Matuatunguila. Entraremos em contacto em breve.\n\nBondo Matuatunguila`;
      
      console.log('=== CONFIGURAÇÃO DE NOTIFICAÇÕES ===');
      console.log('Email destinatário:', email);
      console.log('Telefone destinatário:', phone);
      console.log('Nome do estudante:', studentName);
      console.log('\n📧 EMAIL - Configure seu serviço:');
      console.log('- EmailJS: https://www.emailjs.com/');
      console.log('- SendGrid: https://sendgrid.com/');
      console.log('\n📱 WHATSAPP - Configure seu serviço:');
      console.log('- Twilio: https://www.twilio.com/');
      console.log('=====================================\n');
      
      try {
        const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: 'YOUR_SERVICE_ID',
            template_id: 'YOUR_TEMPLATE_ID',
            user_id: 'YOUR_USER_ID',
            template_params: {
              to_email: email,
              subject: emailSubject,
              message: emailBody,
              to_name: studentName
            }
          })
        }).catch(() => ({ ok: false }));
        
        const whatsappResponse = await fetch('https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT_SID/Messages.json', {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa('YOUR_ACCOUNT_SID:YOUR_AUTH_TOKEN'),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            From: 'whatsapp:+14155238886',
            To: `whatsapp:${phone}`,
            Body: whatsappMessage
          })
        }).catch(() => ({ ok: false }));
        
        return { email: emailResponse.ok, whatsapp: whatsappResponse.ok };
      } catch (error) {
        console.error('Notification error:', error);
        return { email: false, whatsapp: false };
      }
    };

    const updateStatus = async (enrollmentId, newStatus, extraData = {}) => {
      try {
        setSending(true);
        const enrollment = enrollments.find(e => e.objectId === enrollmentId);
        if (!enrollment) {
          setAlert({ message: 'Inscrição não encontrada', type: 'error' });
          setSending(false);
          return;
        }
        
        const finalReason = rejectionReason === 'Outro' ? customReason : rejectionReason;
        await trickleUpdateObject('matricula', enrollmentId, {
          ...enrollment.objectData,
          status: newStatus,
          ...extraData,
          rejectionReason: finalReason || '',
          observations: observations || '',
          lastUpdated: new Date().toISOString()
        });
        
        if (newStatus === 'Aprovado') {
          const notificationResult = await sendNotifications(
            enrollment.objectData.email,
            enrollment.objectData.telefone,
            enrollment.objectData.nomeCompleto
          );
          
          if (notificationResult.email || notificationResult.whatsapp) {
            setAlert({ message: 'Estado atualizado e notificações enviadas!', type: 'success' });
          } else {
            setAlert({ message: 'Estado atualizado mas houve erro ao enviar notificações', type: 'warning' });
          }
        } else {
          setAlert({ message: 'Estado atualizado com sucesso', type: 'success' });
        }
        
        await loadEnrollments();
        setSelected(null);
        setRejectionReason('');
        setCustomReason('');
        setObservations('');
        setSending(false);
      } catch (error) {
        console.error('Update status error:', error);
        setAlert({ message: 'Erro ao atualizar. Tente novamente.', type: 'error' });
        setSending(false);
      }
    };

    const handleLogout = () => {
      localStorage.removeItem('userSession');
      window.location.href = 'login.html';
    };

    const filtered = enrollments.filter(e => {
      const matchFilter = filter === 'Todos' || e.objectData.status === filter;
      const matchSearch = !searchTerm || e.objectData.nomeCompleto?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchFilter && matchSearch;
    });

    const stats = {
      total: enrollments.length,
      pendente: enrollments.filter(e => e.objectData.status === 'Pendente').length,
      apto: enrollments.filter(e => e.objectData.status === 'Apto').length,
      naoApto: enrollments.filter(e => e.objectData.status === 'Não apto').length
    };

    const rejectionReasons = [
      'Falsificação de documentos',
      'Falta de documentos',
      'Documentos ilegíveis',
      'Dados incorretos',
      'Sem vagas disponíveis',
      'Curso indisponível',
      'Outro'
    ];

    return (
      <div className="min-h-screen bg-[var(--bg-light)]">
        <header className="bg-white shadow-md">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <img src="https://remedyao.github.io/Remedy/LGbondo.jpg" alt="Logo" className="h-10 w-10 object-contain" />
                <h1 className="text-2xl font-bold text-[var(--primary-color)]">Painel Administrativo</h1>
              </div>
              <button onClick={handleLogout} className="btn-primary">Sair</button>
            </div>
            <nav className="flex gap-4 border-t pt-4">
              <a href="admin-dashboard.html" className="px-4 py-2 bg-[var(--primary-color)] text-white rounded-lg font-semibold">
                Matrículas
              </a>
              <a href="admin-pre-inscricoes.html" className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300">
                Pré-inscrições
              </a>
              <a href="admin-users.html" className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300">
                Gestão de Utilizadores
              </a>
            </nav>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--text-secondary)] text-sm">Total</p>
                  <p className="text-3xl font-bold text-[var(--primary-color)]">{stats.total}</p>
                </div>
                <div className="icon-users text-3xl text-blue-500"></div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--text-secondary)] text-sm">Pendentes</p>
                  <p className="text-3xl font-bold text-yellow-600">{stats.pendente}</p>
                </div>
                <div className="icon-clock text-3xl text-yellow-500"></div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--text-secondary)] text-sm">Aptos</p>
                  <p className="text-3xl font-bold text-green-600">{stats.apto}</p>
                </div>
                <div className="icon-circle-check text-3xl text-green-500"></div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--text-secondary)] text-sm">Não Aptos</p>
                  <p className="text-3xl font-bold text-red-600">{stats.naoApto}</p>
                </div>
                <div className="icon-x-circle text-3xl text-red-500"></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="mb-6 space-y-4">
              <input type="text" placeholder="Pesquisar por nome..." value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[var(--primary-color)]" />
              
              <div className="flex flex-wrap gap-4">
                {['Todos', 'Pendente', 'Em análise', 'Apto', 'Não apto'].map(status => (
                  <button key={status} onClick={() => setFilter(status)}
                    className={`px-4 py-2 rounded-lg font-semibold transition ${
                      filter === status ? 'bg-[var(--primary-color)] text-white' : 'bg-gray-200'
                    }`}>
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">Nome do Aluno</th>
                    <th className="px-4 py-3 text-left">Curso</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-left">Data de Envio</th>
                    <th className="px-4 py-3 text-left">Estado</th>
                    <th className="px-4 py-3 text-left">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length > 0 ? (
                    filtered.map(enrollment => (
                      <tr key={enrollment.objectId} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold">{enrollment.objectData.nomeCompleto}</div>
                          <div className="text-sm text-gray-500">BI: {enrollment.objectData.biEstudante}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div>{enrollment.objectData.cursoPretendido}</div>
                          <div className="text-sm text-gray-500">{enrollment.objectData.classePretendida}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm">Matrícula</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            {enrollment.objectData.submittedAt ? 
                              new Date(enrollment.objectData.submittedAt).toLocaleDateString('pt-PT') : '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                            {enrollment.objectData.status || 'Pendente'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => setSelected(enrollment)}
                            className="text-[var(--primary-color)] hover:underline font-semibold">
                            Ver Detalhes
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                        Nenhuma matrícula encontrada. As matrículas enviadas pelos estudantes aparecerão aqui.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {selected && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8 my-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Detalhes da Inscrição</h2>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-700">
                  <div className="icon-x text-2xl"></div>
                </button>
              </div>
              
              <div className="space-y-6 mb-6">
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                  <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <div className="icon-user text-xl"></div>
                    Dados Pessoais do Estudante
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div><span className="font-semibold">Nome Completo:</span> {selected.objectData.nomeCompleto}</div>
                    <div><span className="font-semibold">Data de Nascimento:</span> {selected.objectData.dataNascimento}</div>
                    <div><span className="font-semibold">Género:</span> {selected.objectData.genero}</div>
                    <div><span className="font-semibold">BI do Estudante:</span> {selected.objectData.biEstudante}</div>
                  </div>
                </div>
                
                <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
                  <h3 className="text-lg font-semibold text-purple-900 mb-3 flex items-center gap-2">
                    <div className="icon-users text-xl"></div>
                    Dados dos Encarregados
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div><span className="font-semibold">BI do Pai:</span> {selected.objectData.biPai}</div>
                    <div><span className="font-semibold">BI da Mãe:</span> {selected.objectData.biMae}</div>
                  </div>
                </div>
                
                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                  <h3 className="text-lg font-semibold text-green-900 mb-3 flex items-center gap-2">
                    <div className="icon-phone text-xl"></div>
                    Contactos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div><span className="font-semibold">Telefone:</span> {selected.objectData.telefone}</div>
                    <div><span className="font-semibold">Email:</span> {selected.objectData.email}</div>
                    <div className="md:col-span-2"><span className="font-semibold">Endereço:</span> {selected.objectData.endereco}</div>
                  </div>
                </div>
                
                <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded">
                  <h3 className="text-lg font-semibold text-orange-900 mb-3 flex items-center gap-2">
                    <div className="icon-graduation-cap text-xl"></div>
                    Informação Académica
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div><span className="font-semibold">Curso Pretendido:</span> {selected.objectData.cursoPretendido}</div>
                    <div><span className="font-semibold">Classe Pretendida:</span> {selected.objectData.classePretendida}</div>
                    <div><span className="font-semibold">Estado Atual:</span> <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">{selected.objectData.status || 'Pendente'}</span></div>
                    <div><span className="font-semibold">Data de Envio:</span> {selected.objectData.submittedAt ? new Date(selected.objectData.submittedAt).toLocaleString('pt-PT') : '-'}</div>
                  </div>
                </div>
                
                {selected.objectData.documents && (
                  <div className="bg-gray-50 border-l-4 border-gray-500 p-4 rounded">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <div className="icon-file-text text-xl"></div>
                      Documentos Anexados
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(() => {
                        try {
                          const docs = JSON.parse(selected.objectData.documents);
                          const docLabels = {
                            certificado9Classe: 'Certificado da 9ª Classe',
                            atestadoMedico: 'Atestado Médico',
                            cartaoVacinas: 'Cartão de Vacinas',
                            fotoEstudante: 'Foto do Estudante'
                          };
                          return Object.entries(docs).map(([key, value]) => (
                            value && value.data && (
                              <div key={key} className="bg-white p-4 rounded-lg border-2 border-gray-200 hover:border-blue-400 transition">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className="icon-file-text text-xl text-blue-600"></div>
                                    <p className="font-semibold text-sm">{docLabels[key] || key}</p>
                                  </div>
                                </div>
                                
                                {value.type?.startsWith('image/') && (
                                  <div className="mb-3 rounded overflow-hidden border border-gray-200">
                                    <img src={value.data} alt={value.name} className="w-full h-40 object-cover" />
                                  </div>
                                )}
                                
                                {value.type === 'application/pdf' && (
                                  <div className="mb-3 bg-red-50 p-4 rounded text-center">
                                    <div className="icon-file-text text-4xl text-red-600 mb-2"></div>
                                    <p className="text-xs text-gray-600">Documento PDF</p>
                                  </div>
                                )}
                                
                                <div className="flex gap-2">
                                  <button onClick={() => setViewingDocument(value)} 
                                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-semibold flex items-center justify-center gap-1">
                                    <div className="icon-eye text-sm"></div>
                                    Ver
                                  </button>
                                  <a href={value.data} download={value.name} 
                                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-semibold flex items-center justify-center gap-1">
                                    <div className="icon-download text-sm"></div>
                                    Baixar
                                  </a>
                                </div>
                              </div>
                            )
                          ));
                        } catch (e) {
                          return <p className="text-sm text-gray-500 col-span-2">Nenhum documento anexado</p>;
                        }
                      })()}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 border-t-4 border-gray-300 p-6 rounded-lg">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <div className="icon-settings text-2xl"></div>
                  Ações Administrativas
                </h3>
                
                <div className="space-y-6">
                  <div className="bg-white p-5 rounded-lg border-2 border-green-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="icon-circle-check text-2xl text-green-600"></div>
                      <h4 className="font-bold text-green-900">Aceitar Requisição</h4>
                    </div>
                    <p className="text-sm text-gray-700 mb-4">
                      Ao aceitar, o estudante receberá automaticamente uma notificação por <strong>email</strong> e <strong>WhatsApp</strong> informando que a requisição foi aprovada e deve aguardar as próximas orientações.
                    </p>
                    <button 
                      onClick={() => updateStatus(selected.objectId, 'Aprovado')} 
                      disabled={sending}
                      className="w-full bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-bold text-lg flex items-center justify-center gap-2 transition">
                      {sending ? (
                        <>
                          <div className="icon-loader text-xl animate-spin"></div>
                          Enviando notificações...
                        </>
                      ) : (
                        <>
                          <div className="icon-check text-xl"></div>
                          Aceitar Requisição
                        </>
                      )}
                    </button>
                  </div>

                  <div className="bg-white p-5 rounded-lg border-2 border-red-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="icon-x-circle text-2xl text-red-600"></div>
                      <h4 className="font-bold text-red-900">Rejeitar Requisição</h4>
                    </div>
                    <select value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-red-500 focus:border-red-500">
                      <option value="">Selecione o motivo da rejeição</option>
                      {rejectionReasons.map((reason, idx) => (
                        <option key={`reason-${idx}`} value={reason}>{reason}</option>
                      ))}
                    </select>
                    {rejectionReason === 'Outro' && (
                      <input type="text" value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder="Especifique o motivo da rejeição"
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-red-500" />
                    )}
                    <button 
                      onClick={() => updateStatus(selected.objectId, 'Recusado')}
                      disabled={sending || !rejectionReason}
                      className="w-full bg-red-600 text-white px-6 py-4 rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-bold text-lg flex items-center justify-center gap-2 transition">
                      <div className="icon-x text-xl"></div>
                      Rejeitar Requisição
                    </button>
                  </div>

                  <div className="bg-white p-5 rounded-lg border-2 border-blue-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="icon-message-square text-2xl text-blue-600"></div>
                      <h4 className="font-bold text-blue-900">Observações Internas</h4>
                    </div>
                    <textarea value={observations} onChange={(e) => setObservations(e.target.value)}
                      rows="4" placeholder="Adicionar observações internas (opcional)..."
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
                    <p className="text-xs text-gray-500 mt-2">Estas observações são apenas para uso interno e não serão enviadas ao estudante.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {alert && <Alert message={alert.message} type={alert.type} onClose={() => setAlert(null)} />}
        {viewingDocument && <DocumentViewer document={viewingDocument} onClose={() => setViewingDocument(null)} />}
      </div>
    );
  } catch (error) {
    console.error('AdminDashboardApp error:', error);
    return null;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AdminDashboardApp />);